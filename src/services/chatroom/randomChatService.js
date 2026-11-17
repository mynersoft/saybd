import { supabase } from '../supabase/supabaseClient.js';
import { ICE_SERVERS } from '../../config/constants.js';
import { dbService } from '../supabase/dbService.js';

/**
 * Omegle-style random 1-to-1 chat session.
 *
 *  - Matchmaking: Supabase Realtime presence on one lobby channel. Everybody who is
 *    "waiting" is visible; the user with the SMALLER id invites the oldest waiting user
 *    with a LARGER id (so two people never invite each other at the same time).
 *  - Media + chat: peer-to-peer WebRTC. Signaling goes over a private per-pair Realtime
 *    broadcast channel; chat messages travel over an RTCDataChannel (never stored).
 *
 * Events: state, searching_info, partner, remote_stream, local_changed, partner_mode,
 *         message, typing, partner_left, error, info
 * States: idle | searching | connecting | connected
 */

const LOBBY_CHANNEL = 'saybd-chatroom-lobby';
const INVITE_TIMEOUT_MS = 5000;
const SKIP_TTL_MS = 8000;
const CONNECT_TIMEOUT_MS = 20000;

const uid = () => Math.random().toString(36).slice(2, 10);

export class RandomChatSession {
  constructor(me) {
    this.me = me; // { id, full_name, avatar_url }
    this.listeners = {};
    this.state = 'idle';

    this.localStream = null;
    this.facingMode = 'user';
    this.micOn = true;
    this.videoOn = true;

    this.lobby = null;
    this.inviting = null; // { id, timer }
    this.skipUntil = new Map(); // userId -> expiry timestamp
    this.blockedIds = new Set();
    this.joinedAt = 0;
    this.runId = 0;

    this._resetPeerFields();
  }

  /* ---------- tiny emitter ---------- */
  on(evt, fn) {
    (this.listeners[evt] ||= new Set()).add(fn);
    return () => this.listeners[evt]?.delete(fn);
  }
  emit(evt, payload) {
    this.listeners[evt]?.forEach((fn) => {
      try { fn(payload); } catch (e) { console.warn('listener error', e); }
    });
  }
  _setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.emit('state', s);
  }

  _resetPeerFields() {
    this.pc = null;
    this.dc = null;
    this.signal = null;
    this.partner = null;
    this.roomId = null;
    this.isOfferer = false;
    this.offerSent = false;
    this.remoteDescSet = false;
    this.pendingCandidates = [];
    this.remoteStream = null;
    this.videoSender = null;
    this.readyTimer = null;
    this.connectTimer = null;
    this.dropTimer = null;
  }

  /* ---------- local media ---------- */
  async startMedia({ video = true } = {}) {
    if (this.localStream) return this.localStream;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: video ? { facingMode: this.facingMode, width: { ideal: 960 }, height: { ideal: 720 } } : false,
      });
    } catch (err) {
      if (!video) throw new Error('Microphone permission is required.');
      // Camera denied / missing: continue as audio-only
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.emit('info', 'Camera unavailable, joined with audio only.');
      } catch {
        throw new Error('Could not access microphone or camera. Please allow permissions.');
      }
    }
    this.videoOn = this.localStream.getVideoTracks().length > 0;
    this.micOn = true;
    this.emit('local_changed', { micOn: this.micOn, videoOn: this.videoOn });
    return this.localStream;
  }

  toggleMic() {
    const t = this.localStream?.getAudioTracks()[0];
    if (!t) return this.micOn;
    t.enabled = !t.enabled;
    this.micOn = t.enabled;
    this._sendModeToPartner();
    this.emit('local_changed', { micOn: this.micOn, videoOn: this.videoOn });
    return this.micOn;
  }

  /** Video <-> audio-only switch. Turning video off really releases the camera. */
  async setVideoEnabled(enabled) {
    if (!this.localStream) return this.videoOn;
    if (!enabled) {
      this.localStream.getVideoTracks().forEach((t) => {
        t.stop();
        this.localStream.removeTrack(t);
      });
      await this.videoSender?.replaceTrack(null).catch(() => {});
      this.videoOn = false;
    } else {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: this.facingMode, width: { ideal: 960 }, height: { ideal: 720 } },
        });
        const track = s.getVideoTracks()[0];
        this.localStream.addTrack(track);
        await this.videoSender?.replaceTrack(track).catch(() => {});
        this.videoOn = true;
      } catch {
        this.emit('error', 'Could not turn the camera on. Check camera permission.');
        this.videoOn = false;
      }
    }
    this._sendModeToPartner();
    this.emit('local_changed', { micOn: this.micOn, videoOn: this.videoOn });
    return this.videoOn;
  }

  async flipCamera() {
    if (!this.videoOn) return;
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: this.facingMode } },
      });
      const track = s.getVideoTracks()[0];
      this.localStream.getVideoTracks().forEach((t) => {
        t.stop();
        this.localStream.removeTrack(t);
      });
      this.localStream.addTrack(track);
      await this.videoSender?.replaceTrack(track).catch(() => {});
      this.emit('local_changed', { micOn: this.micOn, videoOn: this.videoOn, facing: this.facingMode });
    } catch {
      this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
      this.emit('error', 'Could not switch camera.');
    }
  }

  /* ---------- matchmaking ---------- */
  async search() {
    if (!supabase) {
      this.emit('error', 'Realtime is not configured. Set the Supabase environment variables.');
      return;
    }
    this._teardownPeer();
    await this._closeLobby();
    const run = ++this.runId;
    this._setState('searching');
    this.joinedAt = Date.now();
    this.skipUntil.clear();
    try {
      const ids = await dbService.getBlockedUserIds(this.me.id);
      this.blockedIds = new Set(ids || []);
    } catch { /* ignore */ }
    if (run !== this.runId) return;
    this._openLobby(run);
  }

  _openLobby(run) {
    const ch = supabase.channel(LOBBY_CHANNEL, {
      config: { presence: { key: this.me.id }, broadcast: { self: false } },
    });
    this.lobby = ch;
    ch.on('presence', { event: 'sync' }, () => this._tryMatch())
      .on('broadcast', { event: 'invite' }, ({ payload }) => this._onInvite(payload))
      .on('broadcast', { event: 'accept' }, ({ payload }) => this._onAccept(payload))
      .on('broadcast', { event: 'decline' }, ({ payload }) => this._onDecline(payload))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && run === this.runId) {
          await ch.track({
            id: this.me.id,
            name: this.me.full_name || 'Learner',
            avatar: this.me.avatar_url || null,
            state: 'waiting',
            joinedAt: this.joinedAt,
          });
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && run === this.runId) {
          this.emit('error', 'Connection to the matching server failed. Retrying…');
        }
      });
  }

  async _closeLobby() {
    clearTimeout(this.inviting?.timer);
    this.inviting = null;
    const ch = this.lobby;
    this.lobby = null;
    if (ch) {
      try { await ch.untrack(); } catch { /* ignore */ }
      try { await supabase.removeChannel(ch); } catch { /* ignore */ }
    }
  }

  _waitingUsers() {
    if (!this.lobby) return [];
    const state = this.lobby.presenceState();
    return Object.values(state)
      .map((arr) => arr[arr.length - 1])
      .filter((p) => p && p.state === 'waiting');
  }

  _isSkipped(id) {
    const exp = this.skipUntil.get(id);
    if (!exp) return false;
    if (Date.now() > exp) {
      this.skipUntil.delete(id);
      return false;
    }
    return true;
  }

  _tryMatch() {
    if (this.state !== 'searching' || this.inviting || !this.lobby) return;
    const waiting = this._waitingUsers();
    this.emit('searching_info', { online: waiting.length });
    const cand = waiting
      .filter((p) => p.id !== this.me.id && p.id > this.me.id && !this.blockedIds.has(p.id) && !this._isSkipped(p.id))
      .sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1))[0];
    if (!cand) return;

    const roomId = `rc_${uid()}${uid()}`;
    const timer = setTimeout(() => {
      if (this.inviting?.id !== cand.id) return;
      this.skipUntil.set(cand.id, Date.now() + SKIP_TTL_MS);
      this.inviting = null;
      this._tryMatch();
    }, INVITE_TIMEOUT_MS);
    this.inviting = { id: cand.id, roomId, timer, info: cand };
    this.lobby.send({
      type: 'broadcast',
      event: 'invite',
      payload: { from: this.me.id, to: cand.id, roomId },
    });
  }

  _partnerFromPresence(id) {
    const p = this._waitingUsers().find((x) => x.id === id) ||
      (this.inviting?.id === id ? this.inviting.info : null);
    return { id, full_name: p?.name || 'Stranger', avatar_url: p?.avatar || null };
  }

  _onInvite(p) {
    if (!p || p.to !== this.me.id) return;
    const busy = this.state !== 'searching' || this.inviting || this.blockedIds.has(p.from);
    if (busy) {
      this.lobby?.send({ type: 'broadcast', event: 'decline', payload: { from: this.me.id, to: p.from } });
      return;
    }
    const partner = this._partnerFromPresence(p.from);
    this.lobby?.send({ type: 'broadcast', event: 'accept', payload: { from: this.me.id, to: p.from, roomId: p.roomId } });
    this._beginPeer(p.roomId, partner);
  }

  _onAccept(p) {
    if (!p || p.to !== this.me.id || !this.inviting || this.inviting.id !== p.from) return;
    const partner = this._partnerFromPresence(p.from);
    const roomId = this.inviting.roomId;
    clearTimeout(this.inviting.timer);
    this.inviting = null;
    this._beginPeer(roomId, partner);
  }

  _onDecline(p) {
    if (!p || p.to !== this.me.id || !this.inviting || this.inviting.id !== p.from) return;
    clearTimeout(this.inviting.timer);
    this.skipUntil.set(p.from, Date.now() + SKIP_TTL_MS);
    this.inviting = null;
    this._tryMatch();
  }

  /* ---------- peer connection ---------- */
  async _beginPeer(roomId, partner) {
    if (this.state === 'connecting' || this.state === 'connected') return;
    const run = this.runId;
    this._setState('connecting');
    this._closeLobby();
    this.roomId = roomId;
    this.partner = partner;
    this.isOfferer = String(this.me.id) < String(partner.id);
    this.remoteMode = { video: true, audio: true };
    this.emit('partner', partner);

    // Signaling channel (private to this pair)
    this.signal = supabase.channel(`chatroom:${roomId}`, { config: { broadcast: { self: false } } });
    this.signal.on('broadcast', { event: 'signal' }, ({ payload }) =>
      this._onSignal(payload).catch((e) => console.warn('signal error', e))
    );
    this.signal.on('broadcast', { event: 'dc' }, ({ payload }) => this._onDcMessage(payload));
    await new Promise((resolve) => {
      const t = setTimeout(resolve, 6000);
      this.signal.subscribe((s) => {
        if (s === 'SUBSCRIBED') { clearTimeout(t); resolve(); }
      });
    });
    if (run !== this.runId || this.signal === null) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 4 });
    this.pc = pc;

    // Audio track + a video transceiver that always exists, so video can be switched on/off
    // later with replaceTrack() and no renegotiation.
    const audio = this.localStream?.getAudioTracks()[0];
    if (audio) pc.addTrack(audio, this.localStream);
    const vTrack = this.localStream?.getVideoTracks()[0] || null;
    const vTrans = pc.addTransceiver('video', { direction: 'sendrecv', streams: [this.localStream] });
    this.videoSender = vTrans.sender;
    if (vTrack) await this.videoSender.replaceTrack(vTrack).catch(() => {});

    this.remoteStream = new MediaStream();
    pc.ontrack = (e) => {
      if (!this.remoteStream.getTracks().includes(e.track)) this.remoteStream.addTrack(e.track);
      this.emit('remote_stream', this.remoteStream);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) this._sendSignal({ type: 'candidate', data: e.candidate });
    };
    pc.onconnectionstatechange = () => this._onConnState(pc.connectionState);

    if (this.isOfferer) {
      this._wireDataChannel(pc.createDataChannel('chat'));
    } else {
      pc.ondatachannel = (e) => this._wireDataChannel(e.channel);
    }

    this._sendSignal({ type: 'ready' });
    let tries = 0;
    this.readyTimer = setInterval(() => {
      if (!this.pc || this.pc.connectionState === 'connected' || ++tries > 25) {
        clearInterval(this.readyTimer);
        return;
      }
      this._sendSignal({ type: 'ready' });
    }, 1500);

    this.connectTimer = setTimeout(() => {
      if (this.state === 'connecting') {
        this.emit('info', 'Could not connect, finding someone else…');
        this.next();
      }
    }, CONNECT_TIMEOUT_MS);
  }

  _sendSignal(msg) {
    this.signal?.send({ type: 'broadcast', event: 'signal', payload: { ...msg, from: this.me.id } });
  }

  async _onSignal(msg) {
    const pc = this.pc;
    if (!pc || !msg || msg.from === this.me.id) return;
    switch (msg.type) {
      case 'ready':
        if (this.isOfferer) await this._makeOffer();
        break;
      case 'offer':
        if (this.isOfferer) break;
        await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
        this.remoteDescSet = true;
        await this._flushCandidates();
        await pc.setLocalDescription(await pc.createAnswer());
        this._sendSignal({ type: 'answer', data: pc.localDescription });
        break;
      case 'answer':
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
          this.remoteDescSet = true;
          await this._flushCandidates();
        }
        break;
      case 'candidate':
        if (this.remoteDescSet) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.data)).catch(() => {});
        } else {
          this.pendingCandidates.push(msg.data);
        }
        break;
      case 'bye':
        this._handlePartnerGone();
        break;
      default:
    }
  }

  async _makeOffer() {
    const pc = this.pc;
    if (!pc) return;
    if (this.offerSent) {
      if (pc.signalingState === 'have-local-offer' && pc.localDescription) {
        this._sendSignal({ type: 'offer', data: pc.localDescription });
      }
      return;
    }
    this.offerSent = true;
    await pc.setLocalDescription(await pc.createOffer());
    this._sendSignal({ type: 'offer', data: pc.localDescription });
  }

  async _flushCandidates() {
    const q = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of q) await this.pc?.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
  }

  _onConnState(st) {
    if (st === 'connected') {
      clearTimeout(this.connectTimer);
      clearTimeout(this.dropTimer);
      if (this.state !== 'connected') {
        this._setState('connected');
        this._sendModeToPartner();
      }
      this.emit('quality', 'good');
    } else if (st === 'disconnected') {
      this.emit('quality', 'poor');
      clearTimeout(this.dropTimer);
      this.dropTimer = setTimeout(() => this._handlePartnerGone(), 6000);
    } else if (st === 'failed' || st === 'closed') {
      this._handlePartnerGone();
    }
  }

  _handlePartnerGone() {
    if (this.state !== 'connected' && this.state !== 'connecting') return;
    this.emit('partner_left', this.partner);
  }

  /* ---------- data channel: chat / typing / mode ---------- */
  _wireDataChannel(dc) {
    this.dc = dc;
    dc.onopen = () => this._sendModeToPartner();
    dc.onmessage = (e) => {
      try { this._onDcMessage(JSON.parse(e.data)); } catch { /* ignore */ }
    };
  }

  _sendRaw(obj) {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(obj));
    } else {
      this.signal?.send({ type: 'broadcast', event: 'dc', payload: obj });
    }
  }

  _onDcMessage(m) {
    if (!m) return;
    if (m.t === 'chat') this.emit('message', { id: m.id, text: String(m.text).slice(0, 500), mine: false, ts: Date.now() });
    else if (m.t === 'typing') this.emit('typing', !!m.on);
    else if (m.t === 'mode') this.emit('partner_mode', { video: !!m.video, audio: !!m.audio });
  }

  _sendModeToPartner() {
    if (!this.partner) return;
    this._sendRaw({ t: 'mode', video: this.videoOn, audio: this.micOn });
  }

  sendMessage(text) {
    const clean = String(text || '').trim().slice(0, 500);
    if (!clean || this.state !== 'connected') return null;
    const msg = { id: uid(), text: clean };
    this._sendRaw({ t: 'chat', ...msg });
    return { ...msg, mine: true, ts: Date.now() };
  }

  sendTyping(on) {
    if (this.state === 'connected') this._sendRaw({ t: 'typing', on });
  }

  /* ---------- lifecycle ---------- */
  _teardownPeer() {
    clearInterval(this.readyTimer);
    clearTimeout(this.connectTimer);
    clearTimeout(this.dropTimer);
    if (this.signal && this.partner) this._sendSignal({ type: 'bye' });
    const sig = this.signal;
    const pc = this.pc;
    const dc = this.dc;
    this._resetPeerFields();
    try { dc?.close(); } catch { /* ignore */ }
    try { pc?.close(); } catch { /* ignore */ }
    if (sig) setTimeout(() => supabase.removeChannel(sig).catch(() => {}), 300); // let "bye" flush
  }

  /** Skip this partner and look for a new one. */
  async next() {
    this._teardownPeer();
    this._setState('searching');
    await this.search();
  }

  /** Leave matching entirely (keeps camera/mic so Start is instant). */
  async stop() {
    this.runId += 1;
    this._teardownPeer();
    await this._closeLobby();
    this._setState('idle');
  }

  async destroy() {
    await this.stop();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.listeners = {};
  }
}