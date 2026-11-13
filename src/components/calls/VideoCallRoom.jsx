import React, { useEffect, useRef, useState } from 'react';
import { useCall } from '../../contexts/CallContext.jsx';

export default function VideoCallRoom() {
  const {
    call, callStatus, localStream, remoteStream, error,
    endCall, cancelCall, toggleTrack,
  } = useCall();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream || null;
  }, [remoteStream]);

  if (!call) return null;

  const isAudio = call.callType === 'audio';

  return (
    <section className="fixed inset-0 z-40 flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between p-4">
        <div>
          <p className="font-semibold">{isAudio ? 'Audio call' : 'Video call'}</p>
          <p className="text-sm text-slate-300">{callStatus}</p>
        </div>
        <span className="text-sm text-slate-300">
          {call.direction === 'outgoing' && callStatus === 'ringing' ? 'Calling…' : ''}
        </span>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-3">
        {isAudio ? (
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full bg-slate-700 text-3xl">☎</div>
            <p>SayBD voice call</p>
          </div>
        ) : (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="h-full max-h-full w-full rounded-2xl bg-slate-800 object-cover" />
            <video ref={localVideoRef} autoPlay muted playsInline
              className="absolute bottom-6 right-6 w-28 rounded-xl border border-white/30 bg-slate-700 object-cover sm:w-40" />
          </>
        )}
        {!remoteStream && !isAudio && (
          <p className="absolute text-sm text-slate-300">Waiting for the other person…</p>
        )}
      </div>

      {error && <p role="alert" className="px-4 text-center text-sm text-red-300">{error}</p>}

      <footer className="flex justify-center gap-3 p-5">
        <button onClick={() => setMicOn(toggleTrack('audio'))}
          className="rounded-full bg-slate-700 px-4 py-3">
          {micOn ? 'Mute mic' : 'Unmute mic'}
        </button>
        {!isAudio && (
          <button onClick={() => setCameraOn(toggleTrack('video'))}
            className="rounded-full bg-slate-700 px-4 py-3">
            {cameraOn ? 'Camera off' : 'Camera on'}
          </button>
        )}
        <button onClick={callStatus === 'ringing' && call.direction === 'outgoing' ? cancelCall : endCall}
          className="rounded-full bg-red-600 px-5 py-3 font-semibold">
          End call
        </button>
      </footer>
    </section>
  );
}
