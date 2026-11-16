import React, { useState, useEffect, useRef } from 'react';
import { mediaService } from '../../services/media/mediaService.js';
import { formatSecondsToTimer } from '../../utils/formatters.js';
import { ReportModal } from './ReportModal.jsx';
import { callRecorder } from '../../services/media/callRecorder.js';
import { PostCallDownloadModal } from '../../components/speaking/PostCallDownloadModal.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  ArrowLeft,
  MoreHorizontal,
  Volume2,
  VolumeX,
  SkipForward,
  ShieldAlert,
  Circle,
  Square,
  Download,
} from 'lucide-react';

/* ---------- small UI helpers ---------- */

function PartnerAvatar({ user, className = '' }) {
  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.full_name || 'Partner'}
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center bg-white/15 text-white font-extrabold uppercase ${className}`}
    >
      {(user?.full_name || 'U').charAt(0)}
    </div>
  );
}

function CtrlBtn({ onClick, active = false, danger = false, label, children }) {
  const size = danger ? 'w-16 h-16' : 'w-14 h-14';
  const tone = danger
    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/40'
    : active
      ? 'bg-white text-slate-900'
      : 'bg-white/20 hover:bg-white/30 text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`${size} ${tone} rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-95 shrink-0`}
    >
      {children}
    </button>
  );
}

const HIDDEN_MEDIA = 'absolute w-px h-px opacity-0 pointer-events-none';

/* ---------- main component ---------- */

export function OneToOneCall({
  partner,
  currentUser,
  onEndCall,
  onNextPartner,
  initialAudioOnly = false,
  callRequestId = null,
  // Minimize support (controlled by ActiveCallContext; falls back to local state)
  minimized: minimizedProp,
  onMinimize,
  onExpand,
}) {
  const { addToast } = useNotification();
  const [innerMin, setInnerMin] = useState(false);
  const isMin = minimizedProp ?? innerMin;
  const minimize = () => (onMinimize ? onMinimize() : setInnerMin(true));
  const expand = () => (onExpand ? onExpand() : setInnerMin(false));

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(initialAudioOnly);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [networkQuality, setNetworkQuality] = useState({ rating: 'Excellent', rtt: 38 });
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [connState, setConnState] = useState('waiting');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Manual local recording (never saved to database)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const providerRef = useRef(null);
  const callSecondsRef = useRef(0);
  const finishedRef = useRef(false);
  const addToastRef = useRef(addToast);

  const isVideoCall = !initialAudioOnly;
  const showRemoteVideo = isVideoCall && hasRemoteVideo;
  const connected = connState === 'connected';

  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  useEffect(() => {
    callSecondsRef.current = callSeconds;
  }, [callSeconds]);

  // Speaker button = mute / unmute partner audio
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.muted = speakerOff;
  }, [speakerOff]);

  // Keep the screen awake during the call (best effort)
  useEffect(() => {
    let lock = null;
    let cancelled = false;
    const request = async () => {
      try {
        if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen');
      } catch {
        /* not supported / denied */
      }
    };
    request();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      try {
        lock && lock.release();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const safeCleanupProvider = () => {
    const provider = providerRef.current;
    if (!provider) return;
    providerRef.current = null;
    try {
      provider.leaveRoom && provider.leaveRoom();
    } catch (e) {
      console.warn('leaveRoom failed:', e);
    }
    try {
      provider.cleanup && provider.cleanup();
    } catch (e) {
      console.warn('cleanup failed:', e);
    }
  };

  // Media + WebRTC setup
  useEffect(() => {
    let active = true;
    finishedRef.current = false;
    const provider = mediaService.createCleanProvider();
    providerRef.current = provider;

    async function setupCall() {
      try {
        const stream = await provider.acquireLocalMedia({
          audio: true,
          video: !initialAudioOnly,
        });
        if (active && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        provider.on('remote_stream', (remoteStream) => {
          if (!active || !remoteVideoRef.current) return;
          const el = remoteVideoRef.current;
          if (el.srcObject !== remoteStream) el.srcObject = remoteStream;
          setHasRemoteVideo(remoteStream.getVideoTracks().length > 0);
          const p = el.play();
          if (p && p.catch) p.catch((e) => console.warn('Remote play blocked:', e));
        });
        provider.on('connection_state', (st) => active && setConnState(st));
        provider.on('network_quality', (quality) => {
          if (active) {
            setNetworkQuality({
              rating: quality === 'poor' ? 'Poor' : 'Excellent',
              rtt: quality === 'poor' ? 240 : 42,
            });
          }
        });

        if (!active) {
          provider.cleanup();
          return;
        }
        // Sorted IDs so caller and receiver join the SAME room
        const roomId = `room_${[currentUser.id, partner.id].sort().join('_')}`;
        await provider.joinRoom(roomId, currentUser);
      } catch (err) {
        console.warn('Call setup error:', err);
        if (active) addToastRef.current(err.message || 'Could not start the call.', 'error');
      }
    }

    setupCall();
    const interval = setInterval(() => setCallSeconds((s) => s + 1), 1000);

    return () => {
      active = false;
      clearInterval(interval);
      try {
        if (callRecorder.isRecording) callRecorder.stop().catch(() => {});
      } catch (e) {
        console.warn('Recorder stop on unmount failed:', e);
      }
      safeCleanupProvider();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner.id]);

  /* ---------- controls ---------- */

  const handleToggleMic = () => {
    if (!providerRef.current) return;
    const next = !isMuted;
    try {
      providerRef.current.toggleMicrophone(!next);
    } catch (e) {
      console.warn(e);
    }
    setIsMuted(next);
  };

  const handleToggleVideo = () => {
    if (!providerRef.current) return;
    const next = !isVideoOff;
    try {
      providerRef.current.toggleCamera(!next);
    } catch (e) {
      console.warn(e);
    }
    setIsVideoOff(next);
  };

  const handleToggleRecord = async () => {
    setMenuOpen(false);
    if (isRecording) {
      try {
        const result = await callRecorder.stop();
        setIsRecording(false);
        if (result && result.durationSeconds > 0) {
          setRecordedVideo(result);
          addToastRef.current(
            `Recording completed (${formatSecondsToTimer(result.durationSeconds)}). Ready to download!`,
            'success'
          );
        }
      } catch (err) {
        console.warn('Error stopping call recorder:', err);
        setIsRecording(false);
      }
    } else {
      try {
        await callRecorder.start({
          localVideoEl: localVideoRef.current,
          remoteVideoEl: remoteVideoRef.current,
          partnerName: partner?.full_name || 'Speaking Partner',
          userName: currentUser?.full_name || 'You',
          onTick: (secs) => setRecordingSeconds(secs),
        });
        setIsRecording(true);
        setRecordingSeconds(0);
        addToastRef.current(
          'Local recording started. Stored only in your browser, never saved to the database.',
          'info'
        );
      } catch (err) {
        addToastRef.current(
          err.message || 'Could not start recording. Check media permissions.',
          'error'
        );
      }
    }
  };

  const finalizeRecording = async () => {
    let finalVideo = recordedVideo;
    if (isRecording) {
      try {
        const result = await callRecorder.stop();
        if (result && result.durationSeconds > 0) {
          finalVideo = result;
          setRecordedVideo(result);
        }
      } catch (err) {
        console.warn('Error stopping recorder:', err);
      }
      setIsRecording(false);
    }
    return finalVideo;
  };

  const notifyRemoteEnded = () => {
    if (callRequestId && currentUser?.id) {
      dbService.endCallRequest(callRequestId, currentUser.id).catch(() => {});
    }
  };

  // End the call. fromRemote = true when the OTHER person ended it.
  const performEnd = async (fromRemote = false) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (!fromRemote) notifyRemoteEnded();

    const finalVideo = await finalizeRecording();
    safeCleanupProvider();

    if (finalVideo && finalVideo.url) {
      setRecordedVideo(finalVideo);
      expand(); // make sure the download dialog is visible
      setIsDownloadModalOpen(true);
    } else if (onEndCall) {
      onEndCall(callSecondsRef.current, null);
    }
  };

  const handleEnd = () => performEnd(false);

  // Watch for the partner ending the call (Realtime + polling fallback)
  const performEndRef = useRef(null);
  performEndRef.current = performEnd;

  useEffect(() => {
    if (!callRequestId) return;
    let stopped = false;

    const onRemoteEnded = () => {
      if (stopped || finishedRef.current) return;
      addToastRef.current('Your partner ended the call.', 'info');
      performEndRef.current(true);
    };

    const unsubscribe = dbService.subscribeToCallRequest(callRequestId, (payload) => {
      const status = payload?.new?.status;
      if (status === 'ended' || status === 'cancelled') onRemoteEnded();
    });

    const poll = setInterval(async () => {
      try {
        const row = await dbService.getCallRequest(callRequestId);
        if (row && (row.status === 'ended' || row.status === 'cancelled')) onRemoteEnded();
      } catch {
        /* ignore */
      }
    }, 3000);

    return () => {
      stopped = true;
      clearInterval(poll);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [callRequestId]);

  const handleModalClose = () => {
    setIsDownloadModalOpen(false);
    if (onEndCall) onEndCall(callSecondsRef.current, recordedVideo);
  };

  const handleNext = async () => {
    setMenuOpen(false);
    if (finishedRef.current) return;
    finishedRef.current = true;
    notifyRemoteEnded();
    const finalVideo = await finalizeRecording();
    safeCleanupProvider();
    if (onNextPartner) onNextPartner(callSecondsRef.current, finalVideo);
  };

  /* ---------- layout classes ---------- */

  const miniVideoCard = isMin && showRemoteVideo;
  const containerClass = isMin
    ? miniVideoCard
      ? 'fixed bottom-24 right-3 z-[100] w-28 h-40 rounded-2xl overflow-hidden shadow-2xl border border-white/30 bg-slate-900 text-white cursor-pointer'
      : 'fixed bottom-20 left-3 right-3 md:left-auto md:right-4 md:bottom-4 md:w-80 z-[100] h-16 rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-r from-[#2a1055] to-[#5b21b6] text-white cursor-pointer'
    : 'fixed inset-0 z-[100] overflow-hidden text-white bg-gradient-to-b from-[#1b0a38] via-[#2a1055] to-[#4c1d95]';

  const remoteVideoClass = showRemoteVideo
    ? 'absolute inset-0 w-full h-full object-cover'
    : HIDDEN_MEDIA;

  const showLocalPip = isVideoCall && !isMin && !isVideoOff;
  const localVideoClass = showLocalPip
    ? 'absolute right-4 bottom-36 z-20 w-28 h-40 rounded-2xl object-cover border-2 border-white/70 shadow-2xl -scale-x-100 bg-slate-800'
    : HIDDEN_MEDIA;

  const statusLine = !connected
    ? 'Connecting…'
    : networkQuality.rating === 'Poor'
      ? 'Poor connection'
      : '';

  return (
    <>
      <div
        className={containerClass}
        onClick={isMin ? expand : undefined}
        role={isMin ? 'button' : undefined}
      >
        {/* Media elements stay mounted in every mode so audio never drops */}
        <video ref={remoteVideoRef} autoPlay playsInline className={remoteVideoClass} />
        <video ref={localVideoRef} autoPlay playsInline muted className={localVideoClass} />

        {/* ================= FULL SCREEN ================= */}
        {!isMin && (
          <>
            {showRemoteVideo && (
              <>
                <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/60 to-transparent z-[1] pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/70 to-transparent z-[1] pointer-events-none" />
              </>
            )}

            <div className="relative z-10 flex flex-col h-full pt-[max(0.75rem,env(safe-area-inset-top))]">
              {/* Top bar */}
              <div className="flex items-center justify-between px-4 pt-2">
                <button
                  type="button"
                  onClick={minimize}
                  aria-label="Minimize call"
                  title="Minimize (keep talking while you browse)"
                  className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="text-center min-w-0 px-2">
                  <p className="font-bold text-base truncate max-w-[200px]">
                    {partner?.full_name || 'Partner'}
                  </p>
                  <p className="text-xs text-white/75 font-mono">
                    {formatSecondsToTimer(callSeconds)}
                    {isRecording && (
                      <span className="ml-2 text-rose-300 font-bold animate-pulse">
                        ● REC {formatSecondsToTimer(recordingSeconds)}
                      </span>
                    )}
                  </p>
                  {statusLine && (
                    <p
                      className={`text-[11px] font-semibold ${
                        connected ? 'text-amber-300' : 'text-white/60'
                      }`}
                    >
                      {statusLine}
                    </p>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label="More options"
                    className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center justify-center"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-12 w-56 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl py-1.5 text-sm z-30">
                      <button
                        onClick={handleToggleRecord}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/10 text-left"
                      >
                        {isRecording ? (
                          <Square className="w-4 h-4 text-rose-400 fill-rose-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-rose-400 fill-rose-400" />
                        )}
                        {isRecording ? 'Stop recording' : 'Record (this device only)'}
                      </button>
                      {recordedVideo && !isRecording && (
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            setIsDownloadModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/10 text-left"
                        >
                          <Download className="w-4 h-4 text-indigo-300" />
                          Download recording ({recordedVideo.sizeMB} MB)
                        </button>
                      )}
                      {onNextPartner && (
                        <button
                          onClick={handleNext}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/10 text-left"
                        >
                          <SkipForward className="w-4 h-4 text-indigo-300" />
                          Next partner
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setIsReportOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/10 text-left text-rose-300"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        Report or block
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Middle: avatar view (audio call, or video not arrived yet) */}
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                {!showRemoteVideo && (
                  <>
                    <div className="relative">
                      {connected && (
                        <>
                          <span className="absolute -inset-4 rounded-full bg-white/5 animate-ping" />
                          <span className="absolute -inset-8 rounded-full bg-white/[0.03]" />
                        </>
                      )}
                      <PartnerAvatar
                        user={partner}
                        className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full text-6xl ring-4 ring-white/15 shadow-2xl"
                      />
                    </div>
                    <p className="mt-6 text-sm text-white/70">
                      {isVideoCall
                        ? connected
                          ? 'Waiting for partner video…'
                          : 'Starting video call…'
                        : 'Audio call'}
                    </p>
                  </>
                )}

                {/* Local camera-off placeholder in the PiP spot */}
                {isVideoCall && isVideoOff && (
                  <div className="absolute right-4 bottom-36 z-20 w-28 h-40 rounded-2xl bg-slate-800/90 border-2 border-white/40 flex flex-col items-center justify-center gap-1.5 text-center">
                    <PartnerAvatar
                      user={currentUser}
                      className="w-12 h-12 rounded-full text-lg"
                    />
                    <span className="text-[10px] text-white/70">Camera off</span>
                  </div>
                )}
              </div>

              {/* Bottom controls */}
              <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
                <div className="mx-auto max-w-xs flex items-center justify-center gap-4">
                  <CtrlBtn
                    onClick={() => setSpeakerOff((v) => !v)}
                    active={speakerOff}
                    label={speakerOff ? 'Speaker off' : 'Speaker on'}
                  >
                    {speakerOff ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  </CtrlBtn>
                  <CtrlBtn
                    onClick={handleToggleMic}
                    active={isMuted}
                    label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </CtrlBtn>
                  {isVideoCall && (
                    <CtrlBtn
                      onClick={handleToggleVideo}
                      active={isVideoOff}
                      label={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
                    >
                      {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                    </CtrlBtn>
                  )}
                  <CtrlBtn onClick={handleEnd} danger label="End call">
                    <PhoneOff className="w-7 h-7" />
                  </CtrlBtn>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================= MINIMIZED: audio bar ================= */}
        {isMin && !miniVideoCard && (
          <div className="relative z-10 flex items-center gap-3 h-full px-3">
            <div className="relative shrink-0">
              <PartnerAvatar user={partner} className="w-10 h-10 rounded-full text-sm" />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#2a1055] ${
                  connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate">{partner?.full_name || 'Partner'}</p>
              <p className="text-[11px] text-white/70 font-mono">
                {formatSecondsToTimer(callSeconds)} · Tap to return
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleMic();
              }}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className={`w-9 h-9 rounded-full flex items-center justify-center ${
                isMuted ? 'bg-white text-slate-900' : 'bg-white/20 text-white'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleEnd();
              }}
              aria-label="End call"
              className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ================= MINIMIZED: video card ================= */}
        {miniVideoCard && (
          <>
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
            <span className="absolute left-2 bottom-1.5 z-10 text-[11px] font-mono font-bold">
              {formatSecondsToTimer(callSeconds)}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleEnd();
              }}
              aria-label="End call"
              className="absolute right-1.5 top-1.5 z-10 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Modals sit above the call layer */}
      <div className="relative z-[120]">
        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          partner={partner}
          currentUserId={currentUser.id}
        />
        <PostCallDownloadModal
          isOpen={isDownloadModalOpen}
          onClose={handleModalClose}
          recordedVideo={recordedVideo}
          partner={partner}
          callDurationSeconds={callSeconds}
        />
      </div>
    </>
  );
}
