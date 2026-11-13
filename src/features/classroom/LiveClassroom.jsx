import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../../services/supabase/dbService.js';
import { mediaService } from '../../services/media/mediaService.js';
import { CLASSROOM_MODES } from '../../config/constants.js';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  Users,
  MessageSquare,
  Lock,
  Unlock,
  Radio,
  Volume2,
  VolumeX,
  Shield,
  Sparkles,
  PhoneOff,
  Check,
  X,
  ChevronRight,
  Send,
  AlertCircle,
  UserMinus
} from 'lucide-react';

export function LiveClassroom({ classroom, currentUser, onLeaveClass }) {
  const { addToast } = useNotification();
  const isMentor = currentUser.id === classroom.mentor_id || currentUser.role === 'admin';

  // Classroom state
  const [speakingMode, setSpeakingMode] = useState(classroom.speaking_mode || CLASSROOM_MODES.RAISE_HAND);
  const [isLocked, setIsLocked] = useState(classroom.is_locked || false);
  const [participants, setParticipants] = useState([]);
  const [handQueue, setHandQueue] = useState([]);
  const [hasMicPermission, setHasMicPermission] = useState(isMentor);
  const [isMuted, setIsMuted] = useState(!isMentor); // Mentor on by default, students muted by default
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [activeTab, setActiveTab] = useState('participants'); // 'participants' | 'chat' | 'queue'
  const [chatMessages, setChatMessages] = useState([
    { id: '1', sender: classroom.mentor_name, text: 'Welcome to the live session everyone! Feel free to raise your hand to practice speaking.', time: 'Just now' }
  ]);
  const [newMessage, setNewMessage] = useState('');

  const localVideoRef = useRef(null);
  const mentorVideoRef = useRef(null);
  const providerRef = useRef(null);

  // Load participants and hand queue
  useEffect(() => {
    let active = true;

    async function initClassroom() {
      const parts = await dbService.getClassParticipants(classroom.id);
      const queue = await dbService.getSpeakingQueue(classroom.id);

      if (active) {
        // Add current user if not in participants
        if (!parts.some(p => p.id === currentUser.id)) {
          const updated = [...parts, {
            id: currentUser.id,
            name: currentUser.full_name,
            role: isMentor ? 'mentor' : 'student',
            avatar: currentUser.avatar_url,
            hasMic: isMentor,
            isMuted: !isMentor,
          }];
          setParticipants(updated);
          dbService.setClassParticipants(classroom.id, updated);
        } else {
          setParticipants(parts);
        }
        setHandQueue(queue);
        setHasRaisedHand(queue.some(h => h.userId === currentUser.id));
      }

      // Initialize media streams
      try {
        const provider = mediaService.createCleanProvider();
        providerRef.current = provider;

        // Mentor publishes video & audio by default
        const stream = await provider.acquireLocalMedia({
          audio: true,
          video: isMentor ? true : false,
        });

        if (active && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        await provider.joinRoom(`class_${classroom.id}`, currentUser);

        // Record attendance log for enrolled student (never consumes 1-on-1 daily allowance)
        if (!isMentor) {
          dbService.recordClassAttendanceJoin(classroom.id, classroom.mentor_id, currentUser.id, currentUser.full_name);
        }
      } catch (err) {
        console.warn('Classroom media access fallback:', err);
      }
    }

    initClassroom();

    return () => {
      active = false;
      if (!isMentor) {
        dbService.recordClassAttendanceLeave(classroom.id, currentUser.id);
      }
      if (providerRef.current) {
        providerRef.current.leaveRoom();
        providerRef.current.cleanup();
      }
    };
  }, [classroom.id, classroom.mentor_id, currentUser, isMentor]);

  // Handle Raise Hand (Student)
  const handleToggleRaiseHand = async () => {
    if (hasRaisedHand) {
      const updatedQueue = await dbService.lowerHand(classroom.id, currentUser.id);
      setHandQueue(updatedQueue);
      setHasRaisedHand(false);
      addToast('Hand lowered.', 'info');
    } else {
      const updatedQueue = await dbService.raiseHand(classroom.id, currentUser);
      setHandQueue(updatedQueue);
      setHasRaisedHand(true);
      addToast('Hand raised! Mentor notified.', 'success');
    }
  };

  // Mentor approves student from hand queue
  const handleApproveHand = async (handItem) => {
    // Grant mic permission
    const updatedParts = participants.map(p => 
      p.id === handItem.userId ? { ...p, hasMic: true, isMuted: false } : p
    );
    setParticipants(updatedParts);
    await dbService.setClassParticipants(classroom.id, updatedParts);

    // Remove from queue
    const updatedQueue = await dbService.lowerHand(classroom.id, handItem.userId);
    setHandQueue(updatedQueue);

    addToast(`Granted speaking permission to ${handItem.userName}`, 'success');
  };

  // Mentor rejects hand
  const handleRejectHand = async (handItem) => {
    const updatedQueue = await dbService.lowerHand(classroom.id, handItem.userId);
    setHandQueue(updatedQueue);
    addToast(`Dismissed hand request from ${handItem.userName}`, 'info');
  };

  // Switch speaking mode (Mentor)
  const handleSwitchMode = async (newMode) => {
    setSpeakingMode(newMode);
    await dbService.updateClass(classroom.id, { speaking_mode: newMode });
    addToast(
      newMode === CLASSROOM_MODES.OPEN_DISCUSSION
        ? 'Switched to Mode B: Open Discussion Mode'
        : 'Switched to Mode A: Raise Hand Mode',
      'info'
    );
  };

  // Mentor Mute All
  const handleMuteAll = async () => {
    const updated = participants.map(p => p.role === 'mentor' ? p : { ...p, isMuted: true, hasMic: false });
    setParticipants(updated);
    await dbService.setClassParticipants(classroom.id, updated);
    addToast('All student microphones have been muted.', 'info');
  };

  // Toggle Camera
  const handleToggleCamera = () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);
    if (providerRef.current) {
      providerRef.current.toggleCamera(!nextVideoOff);
    }
    addToast(nextVideoOff ? 'Camera turned off' : 'Camera turned on', 'info');
  };

  // Lock / Unlock Classroom
  const handleToggleLock = async () => {
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);
    await dbService.updateClass(classroom.id, { is_locked: nextLocked });
    addToast(nextLocked ? 'Classroom locked. No new entries allowed.' : 'Classroom unlocked.', 'info');
  };

  // Start / End Live Class
  const [classStatus, setClassStatus] = useState(classroom.status || 'scheduled');

  const handleStartLive = async () => {
    try {
      await dbService.startLiveClass(classroom.id);
      setClassStatus('live');
      addToast('Classroom is now LIVE! Attendance logging active.', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to start class.', 'error');
    }
  };

  const handleEndLive = async () => {
    if (!confirm('End live class? This will conclude the session and log final student attendance.')) return;
    try {
      await dbService.endLiveClass(classroom.id);
      setClassStatus('completed');
      addToast('Class ended successfully. Attendance records saved.', 'success');
      onLeaveClass && onLeaveClass();
    } catch (err) {
      addToast(err.message || 'Failed to end class.', 'error');
    }
  };

  // Individual Participant Mic & Moderation Controls (Mentor)
  const handleAllowMic = async (p) => {
    const updated = participants.map(item => item.id === p.id ? { ...item, hasMic: true, isMuted: false } : item);
    setParticipants(updated);
    await dbService.setClassParticipants(classroom.id, updated);
    addToast(`Microphone granted to ${p.name}`, 'success');
  };

  const handleRevokeMic = async (p) => {
    const updated = participants.map(item => item.id === p.id ? { ...item, hasMic: false, isMuted: true } : item);
    setParticipants(updated);
    await dbService.setClassParticipants(classroom.id, updated);
    addToast(`Microphone revoked from ${p.name}`, 'info');
  };

  const handleMuteIndividual = async (p) => {
    const nextMuted = !p.isMuted;
    const updated = participants.map(item => item.id === p.id ? { ...item, isMuted: nextMuted } : item);
    setParticipants(updated);
    await dbService.setClassParticipants(classroom.id, updated);
    addToast(`${p.name} ${nextMuted ? 'muted' : 'unmuted'}`, 'info');
  };

  const handleRemoveParticipant = async (p) => {
    if (!confirm(`Remove ${p.name} from the classroom?`)) return;
    const updated = participants.filter(item => item.id !== p.id);
    setParticipants(updated);
    await dbService.setClassParticipants(classroom.id, updated);
    await dbService.lowerHand(classroom.id, p.id);
    addToast(`${p.name} removed from classroom.`, 'warning');
  };

  // Student or Mentor toggle own mic
  const handleToggleMyMic = () => {
    const canSpeak = isMentor || speakingMode === CLASSROOM_MODES.OPEN_DISCUSSION || hasMicPermission;
    if (!canSpeak) {
      addToast('Please raise your hand and wait for mentor approval to speak.', 'warning');
      return;
    }

    const nextMuted = !isMuted;

    // Enforce max active mics limit for students in Open Discussion mode
    if (!isMentor && speakingMode === CLASSROOM_MODES.OPEN_DISCUSSION && !nextMuted) {
      const maxMics = classroom.max_active_mics || 8;
      const activeCount = participants.filter(p => p.hasMic && !p.isMuted).length;
      if (activeCount >= maxMics) {
        addToast(`Open Discussion limit reached (${maxMics} active microphones). Please wait for a turn.`, 'warning');
        return;
      }
    }

    setIsMuted(nextMuted);
    if (providerRef.current) {
      providerRef.current.toggleMicrophone(!nextMuted);
    }
  };

  // Send chat message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const msg = {
      id: `chat_${Date.now()}`,
      sender: currentUser.full_name,
      text: newMessage.trim(),
      time: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date()),
    };
    setChatMessages(prev => [...prev, msg]);
    setNewMessage('');
  };

  const activeSpeakers = participants.filter(p => p.hasMic && !p.isMuted);

  return (
    <div className="relative min-h-[85vh] sm:min-h-[90vh] bg-slate-950 text-white rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-slate-800">
      
      {/* Top Classroom Bar */}
      <div className="p-3 sm:p-5 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base sm:text-lg text-white truncate max-w-xs sm:max-w-md">
                {classroom.title}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                LIVE SFU
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Hosted by <strong>{classroom.mentor_name}</strong></span>
              <span>•</span>
              <span className="text-indigo-400 font-semibold">
                {speakingMode === CLASSROOM_MODES.RAISE_HAND ? '✋ Raise Hand Mode' : '🎙️ Open Discussion Mode'}
              </span>
            </p>
          </div>
        </div>

        {/* Status Pills & Leave */}
        <div className="flex items-center gap-2">
          {/* Active Speaking Count */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{activeSpeakers.length} Active Mic{activeSpeakers.length === 1 ? '' : 's'}</span>
          </div>

          {/* Camera toggle */}
          <button
            onClick={handleToggleCamera}
            className={`p-2 rounded-xl text-xs font-bold transition-all ${
              isVideoOff ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          {/* Mentor Lock / Unlock */}
          {isMentor && (
            <button
              onClick={handleToggleLock}
              className={`p-2 rounded-xl text-xs font-bold transition-all ${
                isLocked ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
              title={isLocked ? 'Classroom Locked (Click to Unlock)' : 'Classroom Unlocked (Click to Lock)'}
            >
              {isLocked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4 text-slate-400" />}
            </button>
          )}

          {/* Mentor Start / End Live Class */}
          {isMentor && (
            classStatus === 'live' ? (
              <button
                onClick={handleEndLive}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition-all"
              >
                End Class
              </button>
            ) : (
              <button
                onClick={handleStartLive}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Start Class</span>
              </button>
            )
          )}

          {/* Leave Button */}
          <button
            onClick={onLeaveClass}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-600/90 text-slate-200 hover:text-white text-xs font-bold transition-all"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Leave</span>
          </button>
        </div>
      </div>

      {/* Main Classroom Body: Video Stage + Sidebar Panel */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
        
        {/* Left Video Stage (3 cols) */}
        <div className="lg:col-span-3 p-3 sm:p-6 flex flex-col justify-between bg-slate-950 overflow-y-auto">
          
          {/* Main Stage Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 items-center">
            
            {/* Primary Mentor Stream Stage */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-indigo-500/40 aspect-video flex items-center justify-center shadow-xl group">
              <video
                ref={isMentor ? localVideoRef : mentorVideoRef}
                autoPlay
                playsInline
                muted={isMentor}
                className="w-full h-full object-cover"
              />

              {/* Placeholder when camera inactive */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 pointer-events-none p-4 text-center">
                <img
                  src={classroom.mentor_avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200'}
                  alt={classroom.mentor_name}
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-indigo-500/50 mb-3 shadow-lg"
                />
                <span className="text-sm font-bold text-white">{classroom.mentor_name} (Mentor)</span>
                <span className="text-xs text-indigo-400 mt-0.5">Primary Speaker • High-Definition Stream</span>
              </div>

              <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md text-[11px] font-semibold text-white">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Mentor: {classroom.mentor_name}</span>
              </div>
            </div>

            {/* Active Student Speaker Spotlight (SFU Downstream) */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video flex items-center justify-center shadow-xl">
              <div className="flex flex-col items-center justify-center p-6 text-center">
                {activeSpeakers.length > 0 && activeSpeakers.some(p => p.role !== 'mentor') ? (
                  <>
                    <img
                      src={activeSpeakers.find(p => p.role !== 'mentor')?.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200'}
                      alt="Student Speaker"
                      className="w-20 h-20 rounded-full object-cover ring-4 ring-emerald-500 animate-pulse mb-3"
                    />
                    <span className="text-sm font-bold text-emerald-400">
                      {activeSpeakers.find(p => p.role !== 'mentor')?.name} (Speaking)
                    </span>
                    <span className="text-xs text-slate-400 mt-1">Live Student Discussion Floor</span>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mb-2">
                      <MicOff className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-slate-400">Student Discussion Floor Muted</span>
                    <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                      {speakingMode === CLASSROOM_MODES.RAISE_HAND
                        ? 'Raise your hand to request the microphone from the mentor.'
                        : 'Click Unmute to participate in Open Discussion.'}
                    </p>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Interactive Bottom Control Dock */}
          <div className="mt-4 p-3 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            
            {/* Student & Participant Actions */}
            <div className="flex items-center gap-2">
              
              {/* Mic Toggle */}
              <button
                onClick={handleToggleMyMic}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                    : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMuted ? 'Muted' : 'Speaking (Live)'}</span>
              </button>

              {/* Student Raise Hand Button (Only in Raise Hand Mode) */}
              {!isMentor && speakingMode === CLASSROOM_MODES.RAISE_HAND && (
                <button
                  onClick={handleToggleRaiseHand}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    hasRaisedHand
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 scale-102'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  <Hand className="w-4 h-4" />
                  <span>{hasRaisedHand ? 'Hand Raised ✋' : 'Raise Hand'}</span>
                </button>
              )}
            </div>

            {/* Mentor Mode Switcher Controls */}
            {isMentor && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Speaking Mode:</span>
                <button
                  onClick={() => handleSwitchMode(CLASSROOM_MODES.RAISE_HAND)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    speakingMode === CLASSROOM_MODES.RAISE_HAND
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Raise Hand
                </button>

                <button
                  onClick={() => handleSwitchMode(CLASSROOM_MODES.OPEN_DISCUSSION)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    speakingMode === CLASSROOM_MODES.OPEN_DISCUSSION
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Open Discussion
                </button>

                <button
                  onClick={handleMuteAll}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 text-xs font-bold flex items-center gap-1"
                >
                  <VolumeX className="w-3.5 h-3.5" /> Mute All
                </button>
              </div>
            )}

          </div>

        </div>

        {/* Right Sidebar: Tabs for Participants, Hand Queue, and Live Chat */}
        <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/60 flex flex-col h-[400px] lg:h-auto">
          
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 py-3 text-center transition-colors ${
                activeTab === 'participants' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-white'
              }`}
            >
              Roster ({participants.length})
            </button>

            {isMentor && (
              <button
                onClick={() => setActiveTab('queue')}
                className={`flex-1 py-3 text-center transition-colors relative ${
                  activeTab === 'queue' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-white'
                }`}
              >
                Hands ({handQueue.length})
                {handQueue.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-center transition-colors ${
                activeTab === 'chat' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-white'
              }`}
            >
              Chat
            </button>
          </div>

          {/* Tab Content: Participants */}
          {activeTab === 'participants' && (
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <img
                      src={p.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
                      alt={p.name}
                      className="w-7 h-7 rounded-lg object-cover"
                    />
                    <div className="truncate">
                      <p className="font-bold text-slate-200 truncate">{p.name}</p>
                      <span className="text-[10px] text-slate-400 capitalize">{p.role}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Status indicator */}
                    {p.hasMic && !p.isMuted ? (
                      <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400" title="Microphone Active">
                        <Volume2 className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="p-1 rounded-md bg-slate-800 text-slate-500" title="Muted">
                        <MicOff className="w-3.5 h-3.5" />
                      </span>
                    )}

                    {/* Mentor controls on individual student */}
                    {isMentor && p.role !== 'mentor' && (
                      <div className="flex items-center gap-1 ml-1 pl-1 border-l border-slate-700">
                        {p.hasMic ? (
                          <button
                            onClick={() => handleRevokeMic(p)}
                            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Revoke Microphone"
                          >
                            <MicOff className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAllowMic(p)}
                            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors"
                            title="Allow Microphone"
                          >
                            <Mic className="w-3 h-3" />
                          </button>
                        )}

                        <button
                          onClick={() => handleMuteIndividual(p)}
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors"
                          title={p.isMuted ? 'Unmute Student' : 'Mute Student'}
                        >
                          {p.isMuted ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                        </button>

                        <button
                          onClick={() => handleRemoveParticipant(p)}
                          className="p-1 rounded hover:bg-rose-950 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Remove Participant from Classroom"
                        >
                          <UserMinus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab Content: Hand Queue (Mentor View) */}
          {activeTab === 'queue' && (
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              {handQueue.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <Hand className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                  <p>No raised hands right now</p>
                </div>
              ) : (
                handQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-900/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-[10px] font-bold flex items-center justify-center text-white">
                          {idx + 1}
                        </span>
                        <p className="font-bold text-slate-200">{item.userName}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Waiting for mic permission</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleApproveHand(item)}
                        className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                        title="Approve & Grant Microphone"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRejectHand(item)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab Content: Chat */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="p-2 rounded-xl bg-slate-800/40">
                    <div className="flex items-center justify-between font-bold text-slate-300">
                      <span>{msg.sender}</span>
                      <span className="text-[10px] font-normal text-slate-500">{msg.time}</span>
                    </div>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">{msg.text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendMessage} className="p-2 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
