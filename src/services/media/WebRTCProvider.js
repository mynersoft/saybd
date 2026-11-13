import { MediaProviderInterface } from './MediaProviderInterface.js';
import { ICE_SERVERS } from '../../config/constants.js';

export class WebRTCProvider extends MediaProviderInterface {
  constructor(config = {}) {
    super(config);
    this.peerConnection = null;
    this.roomId = null;
    this.currentParticipant = null;
    this.signalingChannel = null;
    this.networkQuality = 'excellent'; // 'excellent', 'good', 'fair', 'poor'
  }

  async initialize() {
    return true;
  }

  async acquireLocalMedia(constraints = { audio: true, video: true }) {
    try {
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
      }
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.emit('local_stream', this.localStream);
      return this.localStream;
    } catch (error) {
      console.warn('getUserMedia warning/fallback:', error);
      // Fallback: If camera is busy or denied, attempt audio-only
      if (constraints.video) {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          this.emit('local_stream', this.localStream);
          this.emit('media_warning', 'Video unavailable. Connected with Audio-Only.');
          return this.localStream;
        } catch (audioErr) {
          throw new Error('Could not access microphone or camera. Please grant browser permissions.');
        }
      }
      throw error;
    }
  }

  async joinRoom(roomId, participant) {
    this.roomId = roomId;
    this.currentParticipant = participant;

    // Initialize RTCPeerConnection with STUN servers
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers || ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle remote track arrivals
    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.remoteStreams.set('peer_primary', remoteStream);
        this.emit('remote_stream', remoteStream);
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this.emit('connection_state', state);
      if (state === 'connected') {
        this.networkQuality = 'excellent';
        this.emit('network_quality', this.networkQuality);
      } else if (state === 'disconnected' || state === 'failed') {
        this.networkQuality = 'poor';
        this.emit('network_quality', this.networkQuality);
      }
    };

    // Simulated signaling exchange via BroadcastChannel for zero-config multi-tab testing
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.signalingChannel = new BroadcastChannel(`saybd_room_${roomId}`);
      this.signalingChannel.onmessage = async (event) => {
        const { type, data, senderId } = event.data || {};
        if (senderId === participant.id) return; // ignore self

        if (type === 'peer_joined') {
          this.emit('participant_joined', data);
        } else if (type === 'peer_left') {
          this.emit('participant_left', data);
        }
      };

      // Notify others in this room
      this.signalingChannel.postMessage({
        type: 'peer_joined',
        data: participant,
        senderId: participant.id,
      });
    }

    this.emit('room_joined', { roomId, participant });
    return true;
  }

  async leaveRoom() {
    if (this.signalingChannel && this.currentParticipant) {
      try {
        this.signalingChannel.postMessage({
          type: 'peer_left',
          data: this.currentParticipant,
          senderId: this.currentParticipant.id,
        });
        this.signalingChannel.close();
      } catch (e) {
        // ignore
      }
      this.signalingChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.cleanup();
    this.emit('room_left', { roomId: this.roomId });
    this.roomId = null;
    this.currentParticipant = null;
  }

  toggleMicrophone(enabled) {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = enabled;
      this.emit('microphone_state', enabled);
      return enabled;
    }
    return false;
  }

  toggleCamera(enabled) {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = enabled;
      this.emit('camera_state', enabled);
      return enabled;
    }
    return false;
  }

  setParticipantPermissions(participantId, permissions) {
    this.emit('permissions_changed', { participantId, permissions });
  }
}
