import { WebRTCProvider } from './WebRTCProvider.js';
import { LiveKitProvider } from './LiveKitProvider.js';

class MediaServiceFactory {
  constructor() {
    this.activeProvider = null;
    this.providerType = import.meta.env.VITE_MEDIA_PROVIDER || 'webrtc_p2p';
  }

  getProvider(type = null) {
    const targetType = type || this.providerType;
    if (this.activeProvider) {
      return this.activeProvider;
    }

    if (targetType === 'livekit') {
      this.activeProvider = new LiveKitProvider();
    } else {
      this.activeProvider = new WebRTCProvider();
    }
    return this.activeProvider;
  }

  createCleanProvider(type = null) {
    const targetType = type || this.providerType;
    if (targetType === 'livekit') {
      return new LiveKitProvider();
    }
    return new WebRTCProvider();
  }
}

export const mediaService = new MediaServiceFactory();
