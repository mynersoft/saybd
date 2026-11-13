import React from 'react';
import { useCall } from '../../contexts/CallContext.jsx';

export default function CallButton({ userId, callType = 'video', children }) {
  const { startCall } = useCall();

  const handleClick = async () => {
    try {
      await startCall(userId, callType);
    } catch (error) {
      window.alert(error.message);
    }
  };

  return (
    <button type="button" onClick={handleClick} disabled={!userId}>
      {children || (callType === 'audio' ? 'Audio call' : 'Video call')}
    </button>
  );
}
