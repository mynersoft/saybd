import { MediaProviderInterface } from './MediaProviderInterface.js';
import { ICE_SERVERS } from '../../config/constants.js';
import { supabase } from '../supabase/supabaseClient.js';

export class WebRTCProvider extends MediaProviderInterface {
  constructor(config = {}) {
    super(config);
    this.peerConnection = null;
    this.roomId = null;
    this.currentParticipant = null;
    this.channel = null;
    this.localChannel = null;
    this.pendingCandidates = [];
    this.remoteDescSet = false;
    this.offerSent = false;
    this.makingOffer = false;
    this.closed = false;
    this.peerId = null;
    this.retryTimer = null;
    this.networkQuality = 'excellent';
  }

  async initialize() {
    return true;
  }

  async acquireLocalMedia(constraints = { audio: true, video: true }) {
    try {
      if (this.localStream) this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.emit('local_stream', this.localStream);
      return this.localStream;
    } catch (error) {
      console.warn('getUserMedia warning/fallback:', error);
      if (constraints.video) {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          this.emit('local_stream', this.localStream);
          this.emit('media_warning', 'Video unavailable. Connected with Audio-Only.');
          return this.localStream;
        } catch (audioErr) {
          throw new Error('Could not access microphone or camera. Please grant browser permissions.');
        }
      }
      throw error;
    }
  }

  // ---------- signaling ----------
  _send(msg) {
    const payload = { ...msg, from: this.currentParticipant.id };
    if (this.channel) {
      this.channel.send({ type: 'broadcast', event: 'signal', payload });
    } else if (this.localChannel) {
      this.localChannel.postMessage(payload);
    }
  }

  async _openSignaling(roomId) {
    const handler = (msg) =>
      this._onSignal(msg).catch((e) => console.warn('signal error:', e));

    if (supabase) {
      await new Promise((resolve) => {
        this.channel = supabase.channel(`call:${roomId}`, {
          config: { broadcast: { self: false } },
        });
        this.channel.on('broadcast', { event: 'signal' }, ({ payload }) => handler(payload));
        const timer = setTimeout(resolve, 8000);
        this.channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    } else if (typeof BroadcastChannel !== 'undefined') {
      this.localChannel = new BroadcastChannel(`saybd_room_${roomId}`);
      this.localChannel.onmessage = (e) => handler(e.data);
    }
  }

  async _onSignal(msg) {
    if (this.closed || !msg || msg.from === this.currentParticipant.id) return;
    const pc = this.peerConnection;
    if (!pc) return;
    this.peerId = msg.from;
    console.log('[webrtc] signal in:', msg.type);
    const iAmOfferer = String(this.currentParticipant.id) < String(msg.from);

    switch (msg.type) {
      case 'ready':
        this._send({ type: 'ready-ack' });
        if (iAmOfferer) await this._makeOffer();
        break;
      case 'ready-ack':
        if (iAmOfferer) await this._makeOffer();
        break;
      case 'offer': {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
        this.remoteDescSet = true;
        await this._flushCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this._send({ type: 'answer', data: pc.localDescription });
        break;
      }
      case 'answer':
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
          this.remoteDescSet = true;
          await this._flushCandidates();
        }
        break;
      case 'candidate':
        if (this.remoteDescSet) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.data));
          } catch (e) {
            console.warn('addIceCandidate failed:', e);
          }
        } else {
          this.pendingCandidates.push(msg.data);
        }
        break;
      case 'bye':
        this.emit('participant_left', { id: msg.from });
        break;
      default:
        break;
    }
  }

  async _flushCandidates() {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of queued) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.warn('queued candidate failed:', e);
      }
    }
  }

  async _makeOffer() {
    const pc = this.peerConnection;
    if (!pc || this.makingOffer) return;
    if (this.offerSent) {
      if (pc.signalingState === 'have-local-offer' && pc.localDescription) {
        this._send({ type: 'offer', data: pc.localDescription });
      }
      return;
    }
    this.makingOffer = true;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this._send({ type: 'offer', data: pc.localDescription });
      this.offerSent = true;
    } finally {
      this.makingOffer = false;
    }
  }

  // ---------- room lifecycle ----------
  async joinRoom(roomId, participant) {
    if (this.closed) return false;
    this.roomId = roomId;
    this.currentParticipant = participant;

    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers || ICE_SERVERS,
      iceCandidatePoolSize: 4,
    });
    this.peerConnection = pc;

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream));
    }

    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      const incoming = event.streams && event.streams[0];
      if (incoming) {
        incoming.getTracks().forEach((t) => {
          if (!remoteStream.getTracks().includes(t)) remoteStream.addTrack(t);
        });
      } else if (!remoteStream.getTracks().includes(event.track)) {
        remoteStream.addTrack(event.track);
      }
      this.remoteStreams.set('peer_primary', remoteStream);
      this.emit('remote_stream', remoteStream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) this._send({ type: 'candidate', data: event.candidate });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      this.emit('connection_state', state);
      if (state === 'connected') {
        this.networkQuality = 'excellent';
        this.emit('network_quality', this.networkQuality);
      } else if (state === 'disconnected' || state === 'failed') {
        this.networkQuality = 'poor';
        this.emit('network_quality', this.networkQuality);
        if (state === 'failed') {
          console.warn('WebRTC failed. A TURN server is probably needed.');
        }
      }
    };

    await this._openSignaling(roomId);
    if (this.closed) return false;

    this._send({ type: 'ready' });
    let tries = 0;
    this.retryTimer = setInterval(() => {
      if (this.closed || pc.connectionState === 'connected' || ++tries > 20) {
        clearInterval(this.retryTimer);
        return;
      }
      console.log('[webrtc] re-announce', pc.connectionState, pc.signalingState);
      this._send({ type: 'ready' });
    }, 2000);

    this.emit('room_joined', { roomId, participant });
    return true;
  }

  async leaveRoom() {
    this.closed = true;
    clearInterval(this.retryTimer);
    try {
      if (this.currentParticipant) this._send({ type: 'bye' });
    } catch (e) {}
    if (this.channel && supabase) {
      try { supabase.removeChannel(this.channel); } catch (e) {}
      this.channel = null;
    }
    if (this.localChannel) {
      try { this.localChannel.close(); } catch (e) {}
      this.localChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.cleanup();
    this.emit('room_left', { roomId: this.roomId });
    this.roomId = null;
  }

  toggleMicrophone(enabled) {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    if (track) {
      track.enabled = enabled;
      this.emit('microphone_state', enabled);
      return enabled;
    }
    return false;
  }

  toggleCamera(enabled) {
    if (!this.localStream) return false;
    const track = this.localStream.getVideoTracks()[0];
    if (track) {
      track.enabled = enabled;
      this.emit('camera_state', enabled);
      return enabled;
    }
    return false;
  }

  setParticipantPermissions(participantId, permissions) {
    this.emit('permissions_changed', { participantId, permissions });
  }
}