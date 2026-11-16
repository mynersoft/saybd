import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { OneToOneCall } from '../features/speaking/OneToOneCall.jsx';

/**
 * Keeps ONE active 1-to-1 call alive above the router, so the user can minimize
 * it and browse other pages while the call continues.
 *
 *   const { call, startCall, expand } = useActiveCall();
 *   startCall({ partner, callRequestId, audioOnly, onEnd, onNext });
 */
const ActiveCallContext = createContext(null);

export function useActiveCall() {
  const ctx = useContext(ActiveCallContext);
  if (!ctx) throw new Error('useActiveCall must be used inside <ActiveCallProvider>');
  return ctx;
}

export function ActiveCallProvider({ children }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [call, setCall] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const callRef = useRef(null);
  callRef.current = call;

  const startCall = useCallback((config) => {
    if (callRef.current) return; // already in a call
    setMinimized(false);
    setCall({
      key: config.callRequestId || `call_${Date.now()}`,
      ...config,
    });
  }, []);

  const minimize = useCallback(() => setMinimized(true), []);
  const expand = useCallback(() => setMinimized(false), []);

  const handleEnd = (seconds, video) => {
    const c = callRef.current;
    setCall(null);
    setMinimized(false);
    if (c?.onEnd) c.onEnd(seconds, video);
  };

  // "Next partner" only works from the practice lobby (it owns the matching UI).
  // From any other page, it ends the call and takes the user to the lobby.
  const handleNext = (seconds, video) => {
    const c = callRef.current;
    setCall(null);
    setMinimized(false);
    const onLobby = window.location.pathname.startsWith('/practice');
    if (onLobby && c?.onNext) {
      c.onNext(seconds, video);
    } else {
      if (c?.onEnd) c.onEnd(seconds, video);
      navigate('/practice');
    }
  };

  return (
    <ActiveCallContext.Provider value={{ call, minimized, startCall, minimize, expand }}>
      {children}
      {call && currentUser && (
        <OneToOneCall
          key={call.key}
          partner={call.partner}
          currentUser={currentUser}
          initialAudioOnly={!!call.audioOnly}
          callRequestId={call.callRequestId || null}
          minimized={minimized}
          onMinimize={minimize}
          onExpand={expand}
          onEndCall={handleEnd}
          onNextPartner={call.onNext ? handleNext : undefined}
        />
      )}
    </ActiveCallContext.Provider>
  );
}
