import React, { useState, useEffect } from 'react';
import { generateTopThreeLeaderboardCard, getOfficialAppUrl } from '../../utils/leaderboardCardGenerator.js';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import {
  Share2,
  Download,
  Copy,
  Check,
  X,
  Sparkles,
  Loader2,
  Trophy,
  MessageCircle,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';

export function TopThreeShareModal({
  isOpen,
  onClose,
  period = 'today',
  periodLabel = "Today's Top Speakers",
  dateSubtitle = 'Asia/Dhaka Calendar Day',
  topStudents = [],
}) {
  const { addToast } = useNotification();
  const [imageResult, setImageResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  const officialAppUrl = getOfficialAppUrl();
  const promoMessage = `Check out the Top English Speakers on SayBD for ${periodLabel}! Practice English with real community members: ${officialAppUrl}`;

  // Check Web Share API capability
  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanNativeShare(true);
    }
  }, []);

  // Generate image on modal open or period/students change
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsGenerating(true);
    setError(null);

    generateTopThreeLeaderboardCard({
      period,
      periodLabel,
      dateSubtitle,
      topStudents,
      appUrl: officialAppUrl,
    })
      .then((res) => {
        if (isMounted) {
          setImageResult(res);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error generating Top 3 leaderboard card:', err);
          setError('Failed to generate Top 3 image. Please try again.');
          setIsGenerating(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, period, periodLabel, dateSubtitle, topStudents, officialAppUrl]);

  if (!isOpen) return null;

  // --- SHARING ACTIONS ---

  // 1. Direct Image Download
  const handleDownloadImage = () => {
    if (!imageResult?.dataUrl) return;
    const a = document.createElement('a');
    a.href = imageResult.dataUrl;
    a.download = imageResult.filename || `saybd-top3-${period}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setHasDownloaded(true);
    addToast('Top 3 image downloaded successfully!', 'success');
  };

  // 2. Native Share Sheet
  const handleNativeShare = async () => {
    if (!imageResult) return;

    try {
      if (
        navigator.canShare &&
        imageResult.blob &&
        navigator.canShare({
          files: [new File([imageResult.blob], imageResult.filename, { type: 'image/png' })]
        })
      ) {
        const file = new File([imageResult.blob], imageResult.filename, { type: 'image/png' });
        await navigator.share({
          title: `SayBD Top 3 English Speakers - ${periodLabel}`,
          text: promoMessage,
          files: [file],
        });
        addToast('Shared successfully!', 'success');
        return;
      }

      // Fallback: Web Share without file attachment
      if (navigator.share) {
        await navigator.share({
          title: `SayBD Top 3 English Speakers - ${periodLabel}`,
          text: promoMessage,
          url: officialAppUrl,
        });
        addToast('Shared successfully!', 'success');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Native share error:', err);
        handleDownloadImage();
      }
    }
  };

  // 3. WhatsApp Share
  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(promoMessage);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
    addToast('Opening WhatsApp with leaderboard invitation...', 'info');
  };

  // 4. Facebook Share
  const handleShareFacebook = () => {
    const u = encodeURIComponent(officialAppUrl);
    const quote = encodeURIComponent(promoMessage);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${quote}`, '_blank', 'noopener,noreferrer');
    addToast('Opening Facebook Share...', 'info');
  };

  // 5. Messenger Share
  const handleShareMessenger = () => {
    const u = encodeURIComponent(officialAppUrl);
    window.open(`https://www.facebook.com/dialog/send?link=${u}&app_id=291494419107518&redirect_uri=${u}`, '_blank', 'noopener,noreferrer');
    addToast('Opening Messenger...', 'info');
  };

  // 6. Instagram Share
  const handleShareInstagram = async () => {
    if (canNativeShare && imageResult?.blob) {
      try {
        const file = new File([imageResult.blob], imageResult.filename, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `SayBD Top 3 Speakers - ${periodLabel}`,
            files: [file],
          });
          return;
        }
      } catch (e) {
        // Fallback to download + copy caption
      }
    }

    handleDownloadImage();
    try {
      await navigator.clipboard.writeText(promoMessage);
      addToast('Image downloaded & caption copied! Ready to share on Instagram Stories or Feed.', 'success');
    } catch {
      addToast('Image downloaded! Open Instagram to share.', 'success');
    }
  };

  // 7. Copy App Link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(officialAppUrl);
      setCopiedLink(true);
      addToast('Official SayBD link copied to clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      addToast('Failed to copy link', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold ring-1 ring-amber-500/30">
              <Trophy className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  Share Top 3 Speaking Champions
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {period.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Social-ready card with verified 1-on-1 speaking durations and SayBD invitation.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split 2 columns (Preview on left, Share options on right) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Image Preview */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center">
            <div className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl aspect-[4/5] flex items-center justify-center">
              {isGenerating ? (
                <div className="text-center p-6 space-y-3">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-slate-400">
                    Generating Top 3 social share card...
                  </p>
                </div>
              ) : error ? (
                <div className="text-center p-6 space-y-2">
                  <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                  <p className="text-xs text-rose-400 font-semibold">{error}</p>
                </div>
              ) : imageResult?.dataUrl ? (
                <img
                  src={imageResult.dataUrl}
                  alt={`SayBD Top 3 ${periodLabel}`}
                  className="w-full h-full object-contain"
                />
              ) : null}
            </div>

            <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Real Top 3 Data • 1080×1350 High-DPI format</span>
            </div>
          </div>

          {/* Right Column: Social Share Channels & Controls */}
          <div className="lg:col-span-6 space-y-5 flex flex-col justify-between">
            
            {/* Promo Preview Callout */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>SayBD Promotional Caption</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed italic bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                "{promoMessage}"
              </p>
            </div>

            {/* Social Share Grid */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Share to Social Media
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                
                {/* WhatsApp */}
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 font-bold text-xs transition-all active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>WhatsApp</span>
                </button>

                {/* Facebook */}
                <button
                  type="button"
                  onClick={handleShareFacebook}
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 font-bold text-xs transition-all active:scale-95"
                >
                  <Share2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Facebook</span>
                </button>

                {/* Messenger */}
                <button
                  type="button"
                  onClick={handleShareMessenger}
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-sky-50 hover:bg-sky-100/80 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-900 text-sky-800 dark:text-sky-300 font-bold text-xs transition-all active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>Messenger</span>
                </button>

                {/* Instagram */}
                <button
                  type="button"
                  onClick={handleShareInstagram}
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-pink-50 hover:bg-pink-100/80 dark:bg-pink-950/40 dark:hover:bg-pink-900/60 border border-pink-200 dark:border-pink-900 text-pink-800 dark:text-pink-300 font-bold text-xs transition-all active:scale-95"
                >
                  <Smartphone className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0" />
                  <span>Instagram</span>
                </button>
              </div>

              {/* Native Mobile Share Sheet */}
              {canNativeShare && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share via Native Device Sheet</span>
                </button>
              )}
            </div>

            {/* Primary Actions: Download Image & Copy App Link */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                {/* Download Progress Image Button */}
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isGenerating || !imageResult}
                  className={`flex-1 w-full p-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                    hasDownloaded
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
                      : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 hover:scale-101'
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
                      <span>Download Top 3 Image</span>
                    </>
                  )}
                </button>

                {/* Copy App Link Button */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full sm:w-auto px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors active:scale-95"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy App Link</span>
                    </>
                  )}
                </button>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 text-[11px] text-slate-400 p-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Images and links are shared directly by you. SayBD never automatically posts to your social accounts.
                </span>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
