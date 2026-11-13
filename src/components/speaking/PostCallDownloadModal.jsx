import React, { useState } from 'react';
import { formatSecondsToTimer } from '../../utils/formatters.js';
import {
  Download,
  CheckCircle2,
  Play,
  Film,
  HardDrive,
  ShieldCheck,
  X,
  Sparkles,
  ArrowRight,
  Clock,
  UserCheck
} from 'lucide-react';

export function PostCallDownloadModal({
  isOpen,
  onClose,
  recordedVideo,
  partner,
  callDurationSeconds = 0,
  onStartNewCall
}) {
  const [hasDownloaded, setHasDownloaded] = useState(false);

  if (!isOpen || !recordedVideo) return null;

  const handleDownload = () => {
    if (!recordedVideo?.url) return;
    const a = document.createElement('a');
    a.href = recordedVideo.url;
    a.download = recordedVideo.filename || `saybd-session-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setHasDownloaded(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-xs">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-slate-900 dark:text-white">
                  Practice Video Ready to Download
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Recorded in Browser
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Session with <strong>{partner?.full_name || 'Speaking Partner'}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Video Preview Player */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center shadow-inner">
            <video
              src={recordedVideo.url}
              controls
              playsInline
              className="w-full h-full object-contain"
            />
          </div>

          {/* Recording Details & Privacy Guarantee */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Duration</span>
              <p className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {formatSecondsToTimer(recordedVideo.durationSeconds || callDurationSeconds)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">File Size</span>
              <p className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {recordedVideo.sizeMB} MB
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Format</span>
              <p className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 uppercase">
                {recordedVideo.mimeType?.includes('mp4') ? 'MP4' : 'WebM HD'}
              </p>
            </div>
          </div>

          {/* Strict Privacy Notice */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="block text-emerald-800 dark:text-emerald-300 font-bold">
                100% Client-Side Privacy:
              </strong>
              <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-400">
                This recording is kept only in your device's browser memory. It is <strong>never uploaded to our database or servers</strong>. Download it now to keep a personal copy on your device.
              </p>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-5 sm:p-6 pt-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors"
          >
            Close & Go to Lobby
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {onStartNewCall && (
              <button
                onClick={() => {
                  onClose();
                  onStartNewCall();
                }}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Practice Again</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Primary Download Button */}
            <button
              onClick={handleDownload}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                hasDownloaded
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:scale-102'
              }`}
            >
              {hasDownloaded ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Downloaded! Click to Save Again</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 animate-bounce" />
                  <span>Download Recorded Video</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
