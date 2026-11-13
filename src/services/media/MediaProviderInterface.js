/**
 * Media Provider Interface
 * Clean abstraction layer decoupling media transport (WebRTC P2P, LiveKit SFU, etc.)
 * from SayBD's business logic (partner matching, classrooms, permissions).
 */

export class MediaProviderInterface {
  constructor(config = {}) {
    this.config = config;
    this.localStream = null;
    this.remoteStreams = new Map();
    this.eventListeners = new Map();
  }

  async initialize() {
    throw new Error('initialize() must be implemented by MediaProvider');
  }

  async acquireLocalMedia(constraints = { audio: true, video: true }) {
    throw new Error('acquireLocalMedia() must be implemented');
  }

  async joinRoom(roomId, participant) {
    throw new Error('joinRoom() must be implemented');
  }

  async leaveRoom() {
    throw new Error('leaveRoom() must be implemented');
  }

  toggleMicrophone(enabled) {
    throw new Error('toggleMicrophone() must be implemented');
  }

  toggleCamera(enabled) {
    throw new Error('toggleCamera() must be implemented');
  }

  setParticipantPermissions(participantId, permissions) {
    throw new Error('setParticipantPermissions() must be implemented');
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  emit(event, ...args) {
    if (this.eventListeners.has(event)) {
      for (const listener of this.eventListeners.get(event)) {
        try {
          listener(...args);
        } catch (err) {
          console.error(`Error in media event listener for ${event}:`, err);
        }
      }
    }
  }

  cleanup() {
    // Release hardware microphone and camera indicators
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }
    this.remoteStreams.clear();
    this.eventListeners.clear();
  }
}
