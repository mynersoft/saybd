import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mic, MicOff, Video, VideoOff, PhoneOff, SkipForward, MessageCircle,
  SendHorizontal, SwitchCamera, Volume2, VolumeX, Flag, Loader2, Users, Headphones,
  ShieldCheck, Play, Maximize2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { RandomChatSession } from '../../services/chatroom/randomChatService.js';
import { dbService } from '../../services/supabase/dbService.js';
import { formatSecondsToTimer } from '../../utils/formatters.js';
import { ReportModal } from '../speaking/ReportModal.jsx';

/* ---------- small helpers ---------- */

function Avatar({ user, className = '' }) {
  if (user?.avatar_url) {
    return <img src={user.avatar_url} alt={user.full_name || 'User'} className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center bg-white/15 font-extrabold uppercase text-white ${className}`}>
      {(user?.full_name || 'U').charAt(0)}
    </div>
  );
}

function RoundBtn({ onClick, label, active = false, danger = false, disabled = false, badge = 0, children }) {
  const tone = danger
    ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 hover:bg-red-600'
    : active
      ? 'bg-white text-slate-900'
      : 'bg-black/40 text-white hover:bg-black/55';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 disabled:opacity-40 sm:h-14 sm:w-14 ${tone}`}
    >
      {children}
      {badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

/* ---------- main ---------- */

export function ChatRoom() {
  const { currentUser } = useAuth();
  const { addToast } = useNotification();
  const navigate = useNavigate();

  const sessionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const endRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);
  const lastSentAt = useRef(0);
  const toastRef = useRef(addToast);
  toastRef.current = addToast;

  const [phase, setPhase] = useState('idle'); // idle | searching | connecting | connected
  const [starting, setStarting] = useState(false);
  const [partner, setPartner] = useState(null);
  const [partnerMode, setPartnerMode] = useState({ video: true, audio: true });
  const [hasRemoteVideoTrack, setHasRemoteVideoTrack] = useState(false);
  const [local, setLocal] = useState({ micOn: true, videoOn: true });
  const [speakerOn, setSpeakerOn] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [poor, setPoor] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [reportOpen, setReportOpen] = useState(false);
  const chatOpenRef = useRef(false);
  chatOpenRef.current = chatOpen;

  /* ----- session setup ----- */
  useEffect(() => {
    if (!currentUser) return undefined;
    const session = new RandomChatSession(currentUser);
    sessionRef.current = session;

    const offs = [
      session.on('state', (s) => {
        setPhase(s);
        if (s === 'searching') {
          setPartner(null);
          setMessages([]);
          setUnread(0);
          setSeconds(0);
          setPoor(false);
          setPartnerTyping(false);
          setHasRemoteVideoTrack(false);
          setPartnerMode({ video: true, audio: true });
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        }
        // Tell the rest of the app this user is busy so nobody rings them mid-chat
        if (s === 'connected' || s === 'idle') {
          dbService.updateUserPresence(currentUser.id, { isOnline: true, inCall: s === 'connected' }).catch(() => {});
        }
      }),
      session.on('searching_info', ({ online }) => setOnlineCount(online)),
      session.on('partner', setPartner),
      session.on('remote_stream', (stream) => {
        const el = remoteVideoRef.current;
        if (el && el.srcObject !== stream) el.srcObject = stream;
        el?.play?.().catch(() => {});
        setHasRemoteVideoTrack(stream.getVideoTracks().length > 0);
      }),
      session.on('local_changed', (l) => setLocal({ micOn: l.micOn, videoOn: l.videoOn })),
      session.on('partner_mode', setPartnerMode),
      session.on('quality', (q) => setPoor(q === 'poor')),
      session.on('message', (m) => {
        setMessages((prev) => [...prev.slice(-49), m]);
        if (!chatOpenRef.current) setUnread((n) => n + 1);
        setPartnerTyping(false);
      }),
      session.on('typing', (on) => {
        setPartnerTyping(on);
        clearTimeout(typingTimer.current);
        if (on) typingTimer.current = setTimeout(() => setPartnerTyping(false), 4000);
      }),
      session.on('partner_left', () => {
        toastRef.current('Your partner left. Finding someone new…', 'info');
        session.next();
      }),
      session.on('info', (m) => toastRef.current(m, 'info')),
      session.on('error', (m) => toastRef.current(m, 'error')),
    ];

    return () => {
      offs.forEach((off) => off && off());
      session.destroy();
      dbService.updateUserPresence(currentUser.id, { isOnline: true, inCall: false }).catch(() => {});
      sessionRef.current = null;
    };
  }, [currentUser]);

  // Keep the local preview attached to the stream
  useEffect(() => {
    const el = localVideoRef.current;
    const stream = sessionRef.current?.localStream;
    if (el && stream && el.srcObject !== stream) el.srcObject = stream;
  }, [phase, local.videoOn]);

  // Call timer
  useEffect(() => {
    if (phase !== 'connected') return undefined;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Fade tick for the transparent chat bubbles
  useEffect(() => {
    if (chatOpen || messages.length === 0) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [chatOpen, messages.length]);

  // Speaker (partner audio) mute
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.muted = !speakerOn;
  }, [speakerOn, phase]);

  // Auto-scroll chat
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, chatOpen, partnerTyping]);

  // Keep the screen awake
  useEffect(() => {
    let lock = null;
    const req = async () => {
      try { if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); } catch { /* ignore */ }
    };
    req();
    const vis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      try { lock?.release(); } catch { /* ignore */ }
    };
  }, []);

  /* ----- actions ----- */
  const handleStart = async () => {
    const s = sessionRef.current;
    if (!s || starting) return;
    setStarting(true);
    try {
      await s.startMedia({ video: true });
      if (localVideoRef.current) localVideoRef.current.srcObject = s.localStream;
      await s.search();
    } catch (err) {
      addToast(err.message || 'Could not start.', 'error');
    } finally {
      setStarting(false);
    }
  };

  const handleNext = () => sessionRef.current?.next();
  const handleStop = async () => {
    await sessionRef.current?.stop();
    setMessages([]);
  };
  const handleLeave = async () => {
    await sessionRef.current?.stop();
    navigate('/practice');
  };

  const handleToggleVideo = () => sessionRef.current?.setVideoEnabled(!local.videoOn);

  const handleSend = (e) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (Date.now() - lastSentAt.current < 400) return; // light rate limit
    const msg = sessionRef.current?.sendMessage(text);
    if (msg) {
      lastSentAt.current = Date.now();
      setMessages((prev) => [...prev.slice(-49), msg]);
      setDraft('');
      sessionRef.current?.sendTyping(false);
    }
  };

  const handleDraft = (e) => {
    setDraft(e.target.value);
    const t = Date.now();
    if (t - lastTypingSent.current > 2000) {
      lastTypingSent.current = t;
      sessionRef.current?.sendTyping(true);
    }
  };

  const openChat = () => {
    setChatOpen(true);
    setUnread(0);
  };

  /* ----- derived UI ----- */
  const connected = phase === 'connected';
  const showPartnerVideo = connected && partnerMode.video && hasRemoteVideoTrack;
  const audioOnlyNow = connected && !showPartnerVideo;
  const visibleMessages = useMemo(
    () => (chatOpen ? messages : messages.filter((m) => now - m.ts < 9000)),
    [messages, chatOpen, now]
  );

  const statusText = {
    idle: 'Ready',
    searching: onlineCount > 1 ? `Searching… ${onlineCount - 1} online` : 'Searching for a partner…',
    connecting: 'Connecting…',
    connected: poor ? 'Weak connection' : formatSecondsToTimer(seconds),
  }[phase];

  if (!currentUser) return null;

  /* ---------- idle: start screen ---------- */
  if (phase === 'idle') {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gradient-to-b from-[#1b0a38] via-[#2a1055] to-[#4c1d95] px-6 text-center text-white">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white/10 ring-4 ring-white/10">
          <Users className="h-11 w-11" />
        </div>
        <h1 className="text-3xl font-extrabold">Random Chat Room</h1>
        <p className="mt-2 max-w-sm text-sm text-white/75">
          Meet a random SayBD learner on video, practise speaking, then tap Next to meet someone new.
        </p>
        <ul className="mt-5 max-w-sm space-y-1.5 text-left text-xs text-white/70">
          <li className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" /> Be respectful. You can report or block anyone.</li>
          <li className="flex gap-2"><Headphones className="h-4 w-4 shrink-0 text-emerald-300" /> Switch to audio-only any time. Chat is never saved.</li>
        </ul>
        <button
          onClick={handleStart}
          disabled={starting}
          className="mt-8 flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-violet-900 shadow-xl transition active:scale-95 disabled:opacity-60"
        >
          {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
          {starting ? 'Allow camera & mic…' : 'Start chatting'}
        </button>
        {/* hidden so the camera stream can attach before the first match */}
        <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
        <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
      </div>
    );
  }

  /* ---------- main room ---------- */
  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-black text-white md:flex-row">
      {/* ===== Partner pane (top on mobile) ===== */}
      <section className="relative min-h-0 flex-1 overflow-hidden bg-slate-900">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={showPartnerVideo ? 'absolute inset-0 h-full w-full object-cover' : 'absolute h-px w-px opacity-0'}
        />

        {!showPartnerVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1b0a38] via-[#2a1055] to-[#4c1d95] px-6 text-center">
            {phase === 'searching' || phase === 'connecting' ? (
              <>
                <div className="relative">
                  <span className="absolute -inset-5 animate-ping rounded-full bg-white/10" />
                  <Avatar user={currentUser} className="relative h-24 w-24 rounded-full text-3xl ring-4 ring-white/20 sm:h-28 sm:w-28" />
                </div>
                <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-white/90">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {phase === 'connecting' ? `Connecting to ${partner?.full_name || 'partner'}…` : 'Looking for someone to talk to…'}
                </p>
                {phase === 'searching' && (
                  <button onClick={handleStop} className="mt-4 rounded-full bg-white/15 px-5 py-2 text-sm font-semibold hover:bg-white/25">
                    Cancel
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="relative">
                  <span className="absolute -inset-4 animate-ping rounded-full bg-white/5" />
                  <Avatar user={partner} className="relative h-28 w-28 rounded-full text-5xl ring-4 ring-white/15 sm:h-36 sm:w-36" />
                </div>
                <p className="mt-4 text-lg font-bold">{partner?.full_name}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
                  <Headphones className="h-3.5 w-3.5" />
                  {partnerMode.video ? 'Waiting for video…' : 'Audio call'}
                </p>
              </>
            )}
          </div>
        )}

        {/* legibility gradients */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-28 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-48 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button onClick={handleLeave} aria-label="Leave chat room" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-md hover:bg-black/55">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 px-2 text-center drop-shadow">
            <p className="max-w-[200px] truncate text-sm font-bold">{connected ? partner?.full_name : 'SayBD Chat Room'}</p>
            <p className={`font-mono text-[11px] ${poor ? 'text-amber-300' : 'text-white/80'}`}>{statusText}</p>
            {connected && !partnerMode.audio && <p className="text-[10px] text-white/70">Partner is muted</p>}
          </div>
          <button
            onClick={() => setReportOpen(true)}
            disabled={!connected}
            aria-label="Report or block"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-rose-300 backdrop-blur-md hover:bg-black/55 disabled:opacity-30"
          >
            <Flag className="h-4 w-4" />
          </button>
        </div>

        {/* ===== Transparent chat overlay ===== */}
        {connected && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col px-3 pb-2">
            <div
              className={`pointer-events-none mb-2 flex flex-col gap-1.5 overflow-y-auto ${chatOpen ? 'pointer-events-auto max-h-[45%]' : 'max-h-32'}`}
              style={chatOpen ? { maskImage: 'linear-gradient(to bottom, transparent, black 18%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 18%)' } : undefined}
            >
              {visibleMessages.map((m) => (
                <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                  <span
                    className={`max-w-[80%] break-words rounded-2xl px-3 py-1.5 text-sm leading-snug text-white shadow backdrop-blur-sm ${
                      m.mine ? 'rounded-br-sm bg-violet-500/45' : 'rounded-bl-sm bg-white/20'
                    }`}
                  >
                    {m.text}
                  </span>
                </div>
              ))}
              {partnerTyping && (
                <div className="flex justify-start">
                  <span className="rounded-2xl rounded-bl-sm bg-white/15 px-3 py-1.5 text-xs italic text-white/80 backdrop-blur-sm">
                    {partner?.full_name?.split(' ')[0] || 'Partner'} is typing…
                  </span>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {chatOpen && (
              <form onSubmit={handleSend} className="flex items-center gap-2">
                <input
                  value={draft}
                  onChange={handleDraft}
                  maxLength={500}
                  autoFocus
                  placeholder="Type a message…"
                  className="min-w-0 flex-1 rounded-full border border-white/25 bg-white/15 px-4 py-2.5 text-sm text-white placeholder-white/60 outline-none backdrop-blur-md focus:border-white/60"
                />
                <button type="submit" disabled={!draft.trim()} aria-label="Send" className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/80 backdrop-blur-md disabled:opacity-40">
                  <SendHorizontal className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setChatOpen(false)} aria-label="Hide chat" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-md">
                  <Maximize2 className="h-4 w-4 rotate-45" />
                </button>
              </form>
            )}
          </div>
        )}
      </section>

      {/* ===== My pane (bottom on mobile) ===== */}
      <section className="relative min-h-0 flex-1 overflow-hidden bg-slate-800">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${sessionRef.current?.facingMode === 'environment' ? '' : '-scale-x-100'} ${local.videoOn ? '' : 'hidden'}`}
        />
        {!local.videoOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-slate-800 to-slate-900">
            <Avatar user={currentUser} className="h-20 w-20 rounded-full text-3xl ring-4 ring-white/10" />
            <p className="flex items-center gap-1.5 text-xs text-white/70"><Headphones className="h-3.5 w-3.5" /> Audio-only mode</p>
          </div>
        )}
        <span className="absolute left-3 top-3 z-10 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md">You</span>
        {!local.micOn && (
          <span className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-rose-500/80 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md">
            <MicOff className="h-3 w-3" /> Muted
          </span>
        )}

        {/* Controls */}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10">
          <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-2.5">
            <RoundBtn onClick={() => sessionRef.current?.toggleMic()} active={!local.micOn} label={local.micOn ? 'Mute microphone' : 'Unmute microphone'}>
              {local.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </RoundBtn>
            <RoundBtn onClick={handleToggleVideo} active={!local.videoOn} label={local.videoOn ? 'Switch to audio-only' : 'Switch to video'}>
              {local.videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </RoundBtn>
            <RoundBtn onClick={() => (chatOpen ? setChatOpen(false) : openChat())} active={chatOpen} disabled={!connected} badge={unread} label="Chat">
              <MessageCircle className="h-5 w-5" />
            </RoundBtn>
            <RoundBtn onClick={() => setSpeakerOn((v) => !v)} active={!speakerOn} label={speakerOn ? 'Mute partner audio' : 'Unmute partner audio'}>
              {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </RoundBtn>
            {local.videoOn && (
              <RoundBtn onClick={() => sessionRef.current?.flipCamera()} label="Flip camera">
                <SwitchCamera className="h-5 w-5" />
              </RoundBtn>
            )}
            <RoundBtn onClick={handleNext} disabled={phase === 'connecting'} label="Next partner">
              <SkipForward className="h-5 w-5" />
            </RoundBtn>
            <RoundBtn onClick={handleStop} danger label="Stop">
              <PhoneOff className="h-5 w-5" />
            </RoundBtn>
          </div>
        </div>
      </section>

      <ReportModal
        isOpen={reportOpen}
        onClose={() => {
          setReportOpen(false);
        }}
        partner={partner}
        currentUserId={currentUser.id}
      />
    </div>
  );
}