import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { useAuth } from './AuthContext.jsx';
import { supabase } from '../services/supabase/supabaseClient.js';
import { ICE_SERVERS } from '../config/constants.js';
import { createCallSocket } from '../services/calls/socket.js';

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { currentUser } = useAuth();
  const socketRef = useRef(null);
  const callRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const [call, setCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => { callRef.current = call; }, [call]);

  const stopMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    pcRef.current?.close();
    pcRef.current = null;
    pendingCandidatesRef.current = [];
  }, []);

  const resetCall = useCallback(() => {
    stopMedia();
    setCall(null);
    setCallStatus('idle');
    setError('');
  }, [stopMedia]);

  const getMedia = useCallback(async (type) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video',
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const makePeerConnection = useCallback((callId, stream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = event => {
      const [streamFromPeer] = event.streams;
      if (streamFromPeer) setRemoteStream(streamFromPeer);
    };

    pc.onicecandidate = event => {
      if (event.candidate) {
        socketRef.current?.emit('call:ice-candidate', {
          callId,
          data: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        setError('Connection failed. Please check your network or TURN configuration.');
        setCallStatus('failed');
      } else if (pc.connectionState === 'connected') {
        setCallStatus('connected');
      }
    };

    return pc;
  }, []);

  const applyPendingCandidates = useCallback(async pc => {
    const queued = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {
        console.warn('ICE candidate could not be applied:', e);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let activeSocket;

    async function connect() {
      if (!currentUser?.id || !supabase) return;
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token || cancelled) return;

      activeSocket = createCallSocket(token);
      socketRef.current = activeSocket;

      activeSocket.on('connect_error', err => setError(err.message || 'Call server connection failed.'));
      activeSocket.on('call:incoming', incoming => {
        setCall({ ...incoming, direction: 'incoming' });
        setCallStatus('ringing');
      });
      activeSocket.on('call:accepted', async ({ callId }) => {
        setCall(prev => prev?.callId === callId ? { ...prev, status: 'accepted' } : prev);
        try {
          const stream = await getMedia(callRef.current?.callType || 'video');
          const pc = makePeerConnection(callId, stream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          activeSocket.emit('call:offer', { callId, data: offer });
          setCallStatus('connecting');
        } catch (err) {
          setError(err.message || 'Could not start your microphone/camera.');
          activeSocket.emit('call:end', { callId });
          resetCall();
        }
      });
      activeSocket.on('call:offer', async ({ callId, data: offer }) => {
        try {
          const currentCall = callRef.current;
          const stream = localStreamRef.current || await getMedia(currentCall?.callType || 'video');
          const pc = pcRef.current || makePeerConnection(callId, stream);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          await applyPendingCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          activeSocket.emit('call:answer', { callId, data: answer });
          setCallStatus('connecting');
        } catch (err) {
          setError(err.message || 'Could not answer the call.');
        }
      });
      activeSocket.on('call:answer', async ({ callId, data: answer }) => {
        if (callRef.current?.callId !== callId || !pcRef.current) return;
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          await applyPendingCandidates(pcRef.current);
        } catch (err) {
          setError(err.message || 'Could not establish the call.');
        }
      });
      activeSocket.on('call:ice-candidate', async ({ callId, data }) => {
        if (callRef.current?.callId !== callId) return;
        const pc = pcRef.current;
        if (!pc || !pc.remoteDescription) {
          pendingCandidatesRef.current.push(data);
          return;
        }
        try { await pc.addIceCandidate(new RTCIceCandidate(data)); } catch (err) {
          console.warn('ICE candidate error:', err);
        }
      });

      ['call:rejected', 'call:cancelled', 'call:timeout', 'call:ended'].forEach(eventName => {
        activeSocket.on(eventName, payload => {
          if (!callRef.current || payload.callId === callRef.current.callId) resetCall();
        });
      });
    }

    connect();
    return () => {
      cancelled = true;
      activeSocket?.disconnect();
      if (socketRef.current === activeSocket) socketRef.current = null;
      resetCall();
    };
    // Socket lifecycle follows authenticated user identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const startCall = useCallback((receiverId, callType = 'video') => new Promise((resolve, reject) => {
    if (!socketRef.current?.connected) return reject(new Error('Call server is not connected.'));
    if (!receiverId) return reject(new Error('Select a user to call.'));
    setError('');
    socketRef.current.emit('call:initiate', { receiverId, callType }, response => {
      if (!response?.ok) return reject(new Error(response?.error || 'Could not start call.'));
      setCall({ ...response.call, direction: 'outgoing' });
      setCallStatus('ringing');
      resolve(response.call);
    });
  }), []);

  const rejectCall = useCallback(() => {
    if (call?.callId) socketRef.current?.emit('call:reject', { callId: call.callId });
    resetCall();
  }, [call, resetCall]);

  const acceptCall = useCallback(async () => {
    if (!call?.callId || !socketRef.current) return;
    try {
      await getMedia(call.callType);
      makePeerConnection(call.callId, localStreamRef.current);
      socketRef.current.emit('call:accept', { callId: call.callId }, response => {
        if (!response?.ok) {
          setError(response?.error || 'Unable to accept call.');
          resetCall();
          return;
        }
        setCall(prev => ({ ...prev, status: 'accepted' }));
        setCallStatus('connecting');
      });
    } catch (err) {
      setError(err.message || 'Microphone/camera permission was denied.');
      rejectCall();
    }
  }, [call, getMedia, makePeerConnection, rejectCall, resetCall]);

  const cancelCall = useCallback(() => {
    if (call?.callId) socketRef.current?.emit('call:cancel', { callId: call.callId });
    resetCall();
  }, [call, resetCall]);

  const endCall = useCallback(() => {
    if (call?.callId) socketRef.current?.emit('call:end', { callId: call.callId });
    resetCall();
  }, [call, resetCall]);

  const toggleTrack = useCallback(kind => {
    const track = localStreamRef.current?.getTracks().find(t => t.kind === kind);
    if (track) track.enabled = !track.enabled;
    return track ? track.enabled : false;
  }, []);

  return (
    <CallContext.Provider value={{
      call, callStatus, localStream, remoteStream, error,
      startCall, acceptCall, rejectCall, cancelCall, endCall, toggleTrack,
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const value = useContext(CallContext);
  if (!value) throw new Error('useCall must be used inside CallProvider.');
  return value;
}
