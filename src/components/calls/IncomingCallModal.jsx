import React from 'react';
import { useCall } from '../../contexts/CallContext.jsx';

export default function IncomingCallModal({ getCallerName = () => 'SayBD user' }) {
  const { call, acceptCall, rejectCall } = useCall();

  if (!call || call.direction !== 'incoming' || callStatusIsActive(call)) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Incoming call"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <h2 className="text-xl font-semibold">Incoming {call.callType} call</h2>
        <p className="my-3 text-gray-600">{getCallerName(call.callerId)} is calling you.</p>
        <div className="flex justify-center gap-3">
          <button onClick={rejectCall} className="rounded-full bg-red-600 px-5 py-3 text-white">
            Decline
          </button>
          <button onClick={acceptCall} className="rounded-full bg-green-600 px-5 py-3 text-white">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

function callStatusIsActive(call) {
  return call.status === 'accepted' || call.status === 'connected';
}
