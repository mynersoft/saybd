import React from 'react';
import IncomingCallModal from './IncomingCallModal.jsx';
import VideoCallRoom from './VideoCallRoom.jsx';

/** Mount once inside AuthProvider, near the app root. */
export default function CallUI() {
  return (
    <>
      <IncomingCallModal />
      <VideoCallRoom />
    </>
  );
}
