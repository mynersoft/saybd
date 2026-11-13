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
  SkipForward,
  ShieldAlert,
  Signal,
  Volume2,
  Sparkles,
  MessageSquare,
  Circle,
  Square,
  Download,
} from 'lucide-react';

export function OneToOneCall({
  partner,
  currentUser,
  onEndCall,
  onNextPartner,
  initialAudioOnly = false,
  callRequestId = null,
}) {
  const { addToast } = useNotification();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(initialAudioOnly);
  const [callSeconds, setCallSeconds] = useState(0);
  const [networkQuality, setNetworkQuality] = useState({
    rating: 'Excellent',
    rtt: 38,
  });
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [connState, setConnState] = useState('waiting');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [showTopicPrompt, setShowTopicPrompt] = useState(true);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);

  // Manual video recording (NO auto-recording, NO database saving)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const providerRef = useRef(null);
  const callSecondsRef = useRef(0);
  const finishedRef = useRef(false); // guards against double end / double cleanup
  const addToastRef = useRef(addToast);

  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  useEffect(() => {
    callSecondsRef.current = callSeconds;
  }, [callSeconds]);

  // Safe, idempotent provider teardown
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

  // Initialize Media Provider & WebRTC streams
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

        // IMPORTANT: sorted IDs so caller and receiver join the SAME room
        if (!active) {
          provider.cleanup();
          return;
        }
        const roomId = `room_${[currentUser.id, partner.id].sort().join('_')}`;
        await provider.joinRoom(roomId, currentUser);
      } catch (err) {
        console.warn(
          'Call setup error (falling back to simulated stream):',
          err
        );
      }
    }

    setupCall();

    const interval = setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);

    return () => {
      active = false;
      clearInterval(interval);
      try {
        if (callRecorder.isRecording) {
          callRecorder.stop().catch(() => {});
        }
      } catch (e) {
        console.warn('Recorder stop on unmount failed:', e);
      }
      safeCleanupProvider();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner.id]);

  const handleToggleMic = () => {
    if (providerRef.current) {
      const newState = !isMuted;
      try {
        providerRef.current.toggleMicrophone(!newState);
      } catch (e) {
        console.warn(e);
      }
      setIsMuted(newState);
    }
  };

  const handleToggleVideo = () => {
    if (providerRef.current) {
      const nextVideoOff = !isVideoOff;
      try {
        providerRef.current.toggleCamera(!nextVideoOff);
      } catch (e) {
        console.warn(e);
      }
      setIsVideoOff(nextVideoOff);
    }
  };

  // Manual record toggle (button-driven only, NEVER saved to database)
  const handleToggleRecord = async () => {
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
          'Local recording started. Only stored in browser memory; never saved to database.',
          'info'
        );
      } catch (err) {
        addToastRef.current(
          err.message ||
            'Could not start recording. Check media permissions.',
          'error'
        );
      }
    }
  };

  // Stop recorder safely and return the final video (or the earlier one)
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

  // Tell the other person the call is over
  const notifyRemoteEnded = () => {
    if (callRequestId && currentUser?.id) {
      dbService
        .endCallRequest(callRequestId, currentUser.id)
        .catch(() => {});
    }
  };

  // End Call: ALWAYS ends, even if recorder / provider throws.
  // fromRemote = true when the OTHER person ended the call.
  const performEnd = async (fromRemote = false) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (!fromRemote) notifyRemoteEnded();

    const finalVideo = await finalizeRecording();
    safeCleanupProvider();

    if (finalVideo && finalVideo.url) {
      // Show download modal first; call ends when modal closes
      setRecordedVideo(finalVideo);
      setIsDownloadModalOpen(true);
    } else {
      if (onEndCall) onEndCall(callSecondsRef.current, null);
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

    const unsubscribe = dbService.subscribeToCallRequest(
      callRequestId,
      (payload) => {
        const status = payload?.new?.status;
        if (status === 'ended' || status === 'cancelled')
          onRemoteEnded();
      }
    );

    const poll = setInterval(async () => {
      try {
        const row = await dbService.getCallRequest(callRequestId);
        if (
          row &&
          (row.status === 'ended' || row.status === 'cancelled')
        )
          onRemoteEnded();
      } catch {}
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

  // Next Partner
  const handleNext = async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    notifyRemoteEnded();

    const finalVideo = await finalizeRecording();
    safeCleanupProvider();
    if (onNextPartner) onNextPartner(callSecondsRef.current, finalVideo);
  };

  return (
    <div className="relative min-h-[80vh] sm:min-h-[85vh] bg-slate-950 text-white rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-slate-800">
      {/* Top Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-2.5 sm:p-6 flex items-center justify-between bg-linear-to-b from-slate-950/80 to-transparent gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs font-semibold shrink-0">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="font-mono text-xs sm:text-sm tracking-wide">
              {formatSecondsToTimer(callSeconds)}
            </span>
          </div>

          {isRecording && (
            <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-rose-950/90 backdrop-blur-md border border-rose-500/60 text-xs font-bold text-rose-300 animate-pulse shadow-lg shadow-rose-950/50 shrink-0">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="font-mono text-xs">
                REC {formatSecondsToTimer(recordingSeconds)}
              </span>
              <span className="text-[10px] text-rose-400 font-normal hidden sm:inline">
                (Local Memory)
              </span>
            </div>
          )}

          {!isRecording && recordedVideo && (
            <button
              onClick={() => setIsDownloadModalOpen(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-indigo-900/80 backdrop-blur-md border border-indigo-500/60 text-xs font-bold text-indigo-200 hover:text-white transition-all shadow-md shrink-0"
              title="Preview and download your recorded video">
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden xs:inline">Download</span>
              <span className="text-[10px] text-indigo-300 font-mono">
                ({recordedVideo.sizeMB} MB)
              </span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs text-slate-300 shrink-0">
            <Signal
              className={`w-3.5 h-3.5 ${networkQuality.rating === 'Excellent' ? 'text-emerald-400' : 'text-amber-400'}`}
            />
            <span>{networkQuality.rating}</span>
            <span className="text-[10px] text-slate-400">
              ({networkQuality.rtt}ms)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs truncate max-w-[130px] sm:max-w-none">
            <span className="text-slate-400 hidden xs:inline">
              Partner:
            </span>
            <span className="font-bold text-white truncate">
              {partner?.full_name || 'Partner'}
            </span>
          </div>

          <button
            onClick={() => setIsReportOpen(true)}
            className="p-1.5 sm:p-2 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-slate-400 hover:text-rose-400 transition-colors shrink-0"
            title="Report or Block Participant">
            <ShieldAlert className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Video Call Stage */}
      <div className="relative flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-6 pt-16 sm:pt-20 pb-20 sm:pb-28">
        {/* Remote Partner Video */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center group shadow-inner">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          <div
            className={`absolute inset-0 flex-col items-center justify-center p-6 text-center bg-slate-900/95 pointer-events-none ${hasRemoteVideo ? 'hidden' : 'flex'}`}>
            <div className="relative mb-4">
              <img
                src={
                  partner?.avatar_url ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'
                }
                alt={partner?.full_name}
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover ring-4 ring-indigo-500/40 shadow-xl"
              />
              <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 ring-4 ring-slate-900 flex items-center justify-center">
                <Volume2 className="w-3.5 h-3.5 text-white animate-pulse" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white">
              {partner?.full_name}
            </h3>
            <p className="text-xs text-amber-300 mb-1">
              {connState === 'connected' ? 'Connected (no video)' : `Connecting… (${connState})`}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {partner?.country || 'Bangladesh'} •{' '}
              {partner?.native_language || 'Bengali'}
            </p>
          </div>

          <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md text-[11px] font-semibold text-slate-200">
            {partner?.full_name}
          </div>
        </div>

        {/* Local User Video */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transform -scale-x-100 ${isVideoOff ? 'hidden' : 'block'}`}
          />

          {isVideoOff && (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <img
                src={
                  currentUser?.avatar_url ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'
                }
                alt="You"
                className="w-24 h-24 rounded-full object-cover ring-2 ring-indigo-500/30 mb-3"
              />
              <span className="text-sm font-bold text-slate-200">
                You (Camera Off)
              </span>
              <span className="text-xs text-slate-500 mt-0.5">
                Audio stream active
              </span>
            </div>
          )}

          <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md text-[11px] font-semibold text-slate-200">
            <span>You</span>
            {isMuted && (
              <span className="text-rose-400 text-[10px] font-bold">
                (Muted)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Call Controls */}
      <div className="absolute bottom-3 sm:bottom-6 left-1/2 transform -translate-x-1/2 z-30 flex items-center justify-center gap-1.5 sm:gap-3 p-2 sm:p-3 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl max-w-[96vw] overflow-x-auto">
        <button
          onClick={handleToggleMic}
          className={`p-2.5 sm:p-3.5 rounded-xl transition-all font-bold shrink-0 ${
            isMuted
              ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 ring-1 ring-rose-500/40'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}>
          {isMuted ? (
            <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>

        <button
          onClick={handleToggleVideo}
          className={`p-2.5 sm:p-3.5 rounded-xl transition-all font-bold shrink-0 ${
            isVideoOff
              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 ring-1 ring-amber-500/40'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
          title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}>
          {isVideoOff ? (
            <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <Video className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>

        <button
          onClick={handleToggleRecord}
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2.5 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
            isRecording
              ? 'bg-rose-600/30 text-rose-300 ring-2 ring-rose-500 hover:bg-rose-600/40 animate-pulse'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
          }`}
          title={
            isRecording
              ? 'Click to Stop Recording'
              : 'Start Local Video Recording (Stored in browser memory only)'
          }>
          {isRecording ? (
            <>
              <Square className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-ping" />
              <span className="font-mono text-rose-400 font-bold text-xs">
                {formatSecondsToTimer(recordingSeconds)}
              </span>
              <span className="hidden md:inline text-xs font-semibold">
                Stop
              </span>
            </>
          ) : (
            <>
              <Circle className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
              <span className="hidden sm:inline">Record</span>
            </>
          )}
        </button>

        <button
          onClick={() => setShowTopicPrompt(!showTopicPrompt)}
          className="p-2.5 sm:p-3.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors shrink-0"
          title="Toggle Conversation Topic">
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <button
          onClick={handleNext}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 shrink-0"
          title="Skip to Next Speaking Partner">
          <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Next</span>
          <span className="hidden sm:inline">Partner</span>
        </button>

        <button
          onClick={handleEnd}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-rose-600/30 transition-all hover:scale-105 shrink-0"
          title="End Speaking Session">
          <PhoneOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">End Call</span>
        </button>
      </div>

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
  );
}