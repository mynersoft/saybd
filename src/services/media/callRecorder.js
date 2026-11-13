/**
 * @license
 * SayBD Client-Side Media Call Recorder
 * 
 * STRICT PRIVACY REQUIREMENT:
 * - NO automatic recording (manual button only).
 * - ZERO database/cloud upload. Recordings are kept exclusively in browser RAM/Blob.
 * - Downloads directly to the user's local disk via Blob URL.
 */

export class CallRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.startTime = null;
    this.animFrameId = null;
    this.audioContext = null;
    this.canvas = null;
    this.ctx = null;
    this.combinedStream = null;
    this.timerInterval = null;
    this.elapsedSeconds = 0;
    this.onTimerTick = null;
  }

  // Get supported MIME type in current browser
  static getSupportedMimeType() {
    if (typeof window === 'undefined' || !window.MediaRecorder) return null;
    const types = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4;codecs=h264,aac',
      'video/mp4',
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  }

  /**
   * Start local recording using canvas compositor + mixed audio
   */
  async start({ localVideoEl, remoteVideoEl, partnerName = 'Partner', userName = 'You', onTick = null }) {
    if (this.isRecording) return;
    if (typeof window === 'undefined' || !window.MediaRecorder) {
      throw new Error('Video recording is not supported in this browser.');
    }

    this.recordedChunks = [];
    this.elapsedSeconds = 0;
    this.onTimerTick = onTick;

    // 1. Setup composite canvas (1280x720 16:9 HD)
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1280;
    this.canvas.height = 720;
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    // 2. Setup Audio Mixing via Web Audio API
    let mixedAudioTrack = null;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const destination = this.audioContext.createMediaStreamDestination();

        // Connect local microphone stream if available
        if (localVideoEl?.srcObject) {
          const localAudioTracks = localVideoEl.srcObject.getAudioTracks();
          if (localAudioTracks.length > 0) {
            const localSource = this.audioContext.createMediaStreamSource(localVideoEl.srcObject);
            localSource.connect(destination);
          }
        }

        // Connect remote partner stream if available
        if (remoteVideoEl?.srcObject) {
          const remoteAudioTracks = remoteVideoEl.srcObject.getAudioTracks();
          if (remoteAudioTracks.length > 0) {
            const remoteSource = this.audioContext.createMediaStreamSource(remoteVideoEl.srcObject);
            remoteSource.connect(destination);
          }
        }

        const mixedTracks = destination.stream.getAudioTracks();
        if (mixedTracks.length > 0) {
          mixedAudioTrack = mixedTracks[0];
        }
      }
    } catch (err) {
      console.warn('AudioContext mixing notice (falling back):', err);
    }

    // 3. Continuous Canvas Compositor Loop (~30 fps)
    const draw = () => {
      if (!this.isRecording) return;

      const { ctx, canvas } = this;
      const w = canvas.width;
      const h = canvas.height;

      // Dark studio background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      // --- Left Window: Remote Partner (w/2 - 16, h - 32) ---
      const paneW = Math.floor(w / 2) - 20;
      const paneH = h - 60;
      const topY = 40;

      // Draw Partner Pane
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(16, topY, paneW, paneH, 16);
      ctx.fill();
      ctx.clip();

      const hasRemoteVideo = remoteVideoEl && remoteVideoEl.readyState >= 2 && !remoteVideoEl.paused && remoteVideoEl.videoWidth > 0;
      if (hasRemoteVideo) {
        ctx.drawImage(remoteVideoEl, 16, topY, paneW, paneH);
      } else {
        // Fallback card with partner avatar
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(16, topY, paneW, paneH);
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(16 + paneW / 2, topY + paneH / 2 - 30, 60, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(partnerName.charAt(0).toUpperCase(), 16 + paneW / 2, topY + paneH / 2 - 18);

        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(partnerName, 16 + paneW / 2, topY + paneH / 2 + 55);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px sans-serif';
        ctx.fillText('Speaking Partner • Audio Active', 16 + paneW / 2, topY + paneH / 2 + 85);
      }

      // Partner name tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(28, topY + paneH - 46, 200, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(partnerName, 38, topY + paneH - 24);
      ctx.restore();

      // --- Right Window: Local User (w/2 - 16, h - 32) ---
      const rightX = Math.floor(w / 2) + 4;
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(rightX, topY, paneW, paneH, 16);
      ctx.fill();
      ctx.clip();

      const hasLocalVideo = localVideoEl && localVideoEl.readyState >= 2 && !localVideoEl.paused && localVideoEl.videoWidth > 0;
      if (hasLocalVideo) {
        // Mirror local video for natural reflection
        ctx.save();
        ctx.translate(rightX + paneW, topY);
        ctx.scale(-1, 1);
        ctx.drawImage(localVideoEl, 0, 0, paneW, paneH);
        ctx.restore();
      } else {
        // Fallback user avatar card
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(rightX, topY, paneW, paneH);
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(rightX + paneW / 2, topY + paneH / 2 - 30, 60, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(userName.charAt(0).toUpperCase(), rightX + paneW / 2, topY + paneH / 2 - 18);

        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(userName, rightX + paneW / 2, topY + paneH / 2 + 55);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px sans-serif';
        ctx.fillText('You • Audio Stream Active', rightX + paneW / 2, topY + paneH / 2 + 85);
      }

      // Local name tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(rightX + 12, topY + paneH - 46, 120, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('You', rightX + 22, topY + paneH - 24);
      ctx.restore();

      // --- Top Branding Bar & REC Indicator ---
      ctx.fillStyle = '#6366f1';
      ctx.font = 'black 16px sans-serif';
      ctx.fillText('SayBD English Practice', 20, 26);

      // REC badge in top right
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(w - 140, 20, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px monospace';
      const m = String(Math.floor(this.elapsedSeconds / 60)).padStart(2, '0');
      const s = String(this.elapsedSeconds % 60).padStart(2, '0');
      ctx.fillText(`REC ${m}:${s}`, w - 124, 25);

      this.animFrameId = requestAnimationFrame(draw);
    };

    // 4. Capture canvas stream
    let canvasStream;
    try {
      canvasStream = this.canvas.captureStream(30);
    } catch {
      // Fallback: direct stream from local video
      canvasStream = localVideoEl?.srcObject || remoteVideoEl?.srcObject;
    }

    // 5. Combine Canvas Video Track + Mixed Audio Track
    const tracks = [];
    if (canvasStream && canvasStream.getVideoTracks().length > 0) {
      tracks.push(canvasStream.getVideoTracks()[0]);
    }
    if (mixedAudioTrack) {
      tracks.push(mixedAudioTrack);
    } else if (localVideoEl?.srcObject?.getAudioTracks().length > 0) {
      tracks.push(localVideoEl.srcObject.getAudioTracks()[0]);
    }

    this.combinedStream = new MediaStream(tracks);

    // 6. Initialize MediaRecorder
    const mimeType = CallRecorder.getSupportedMimeType();
    const options = mimeType ? { mimeType } : {};

    try {
      this.mediaRecorder = new MediaRecorder(this.combinedStream, options);
    } catch (e) {
      console.warn('Fallback to bare MediaRecorder:', e);
      this.mediaRecorder = new MediaRecorder(this.combinedStream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.isRecording = true;
    this.startTime = Date.now();
    this.mediaRecorder.start(1000); // chunk every 1s

    // Start drawing loop
    draw();

    // Start timer interval
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      if (this.onTimerTick) {
        this.onTimerTick(this.elapsedSeconds);
      }
    }, 1000);

    return true;
  }

  /**
   * Stop local recording and return blob + object URL
   * STRICT: Never saves to database.
   */
  async stop() {
    if (!this.isRecording) {
      return null;
    }

    this.isRecording = false;

    // Stop timer
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Stop animation frame
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    // Stop MediaRecorder and resolve blob
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(this._finalizeResult());
        return;
      }

      this.mediaRecorder.onstop = () => {
        resolve(this._finalizeResult());
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.warn('Error stopping MediaRecorder:', e);
        resolve(this._finalizeResult());
      }
    });
  }

  _finalizeResult() {
    // Close AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch {}
    }

    const mime = this.mediaRecorder?.mimeType || 'video/webm';
    const blob = new Blob(this.recordedChunks, { type: mime });
    const url = URL.createObjectURL(blob);
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    const dateStr = new Date().toISOString().split('T')[0];
    const extension = mime.includes('mp4') ? 'mp4' : 'webm';
    const filename = `saybd-practice-${dateStr}-${Date.now()}.${extension}`;

    const result = {
      blob,
      url,
      sizeMB,
      durationSeconds: this.elapsedSeconds,
      filename,
      mimeType: mime,
      createdAt: new Date().toISOString(),
    };

    // Cleanup tracks
    if (this.combinedStream) {
      this.combinedStream.getTracks().forEach((t) => t.stop());
    }

    return result;
  }
}

export const callRecorder = new CallRecorder();
