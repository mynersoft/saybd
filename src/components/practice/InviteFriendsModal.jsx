import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import { Modal } from '../common/Modal.jsx';
import { Share2, Copy, Check, MessageCircle, Clock, ShieldCheck, RefreshCw, Sparkles, ExternalLink } from 'lucide-react';

export function InviteFriendsModal({ isOpen, onClose }) {
  const { currentUser } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const generateInvite = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    setError(null);
    try {
      const inv = await dbService.createPracticeInvitation({
        creatorId: currentUser.id,
        roomName: `${currentUser.full_name?.split(' ')[0] || 'Friend'}'s Practice Session`,
        expiresInHours: 24
      });
      setInvitation(inv);
    } catch (err) {
      setError(err.message || 'Failed to generate invitation link.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !invitation) {
      generateInvite();
    }
  }, [isOpen]);

  const inviteUrl = invitation
    ? `${window.location.origin}/practice/invite/${invitation.token}`
    : '';

  const shareText = `Let's practice spoken English together on SayBD! Join me here: ${inviteUrl}`;

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!inviteUrl) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Practice English on SayBD',
          text: shareText,
          url: inviteUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Friends to Practice">
      <div className="space-y-5 p-1">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Share2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Practice 1-on-1 With a Friend
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Generate an instant, secure practice link. Send it to a friend or classmate to practice English together in real time.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500">Creating personal practice link...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Link Box */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Shareable Practice Link
              </label>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="bg-transparent text-xs text-slate-800 dark:text-slate-200 w-full focus:outline-none font-mono px-2 select-all"
                />
                <button
                  onClick={handleCopy}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Share Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={handleWhatsAppShare}
                className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={handleNativeShare}
                className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span>Share Link</span>
              </button>

              <button
                onClick={generateInvite}
                disabled={loading}
                className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>New Link</span>
              </button>
            </div>

            {/* Features Info */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Link is valid for <strong>24 hours</strong> from creation.</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Real-time peer-to-peer WebRTC connection.</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Both users' daily speaking time is recorded toward Asia/Dhaka quota.</span>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
