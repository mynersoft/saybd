import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal.jsx';
import { AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { dbService } from '../../services/supabase/dbService.js';
import { useNotification } from '../../contexts/NotificationContext.jsx';

export function ReportModal({ isOpen, onClose, partner, currentUserId }) {
  const { addToast } = useNotification();
  const [reason, setReason] = useState('Inappropriate Language or Behavior');
  const [details, setDetails] = useState('');
  const [blockUserToo, setBlockUserToo] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const reasons = [
    'Inappropriate Language or Behavior',
    'Camera / Video Misconduct',
    'Spamming / Advertising / Unrelated',
    'Harassment or Personal Questions',
    'Bad Connection / Refusing to Speak',
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!partner) return;

    await dbService.reportUser({
      reporter_id: currentUserId,
      reported_id: partner.id,
      reason,
      details,
    });

    if (blockUserToo) {
      await dbService.blockUser(currentUserId, partner.id);
    }

    setSubmitted(true);
    addToast('Report submitted. Our moderation team reviews all flagged sessions.', 'info');
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Report Participant" maxWidth="max-w-md">
      {submitted ? (
        <div className="py-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white">Report Received</h4>
          <p className="text-xs text-slate-500">Thank you for keeping SayBD a safe and respectful community.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>Reporting <strong>{partner?.full_name || 'Participant'}</strong>. We take community safety very seriously.</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Reason for Report
            </label>
            <div className="space-y-1.5">
              {reasons.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    reason === r
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 font-semibold text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="report_reason"
                    value={r}
                    checked={reason === r}
                    onChange={(e) => setReason(e.target.value)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Additional Details (Optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="Provide context for our moderators..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={blockUserToo}
              onChange={(e) => setBlockUserToo(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Block this user from ever matching with me again</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
            >
              Submit Report
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
