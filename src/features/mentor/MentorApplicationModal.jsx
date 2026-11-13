import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import { Modal } from '../../components/common/Modal.jsx';
import { Sparkles, Award, BookOpen, CheckCircle, Send, Briefcase, FileText } from 'lucide-react';

export function MentorApplicationModal({ isOpen, onClose, onSubmitted }) {
  const { currentUser } = useAuth();
  const { addToast } = useNotification();

  const [formData, setFormData] = useState({
    title: '',
    bio: '',
    yearsExperience: '3',
    expertise: 'IELTS Speaking, Pronunciation',
    resumeUrl: '',
    videoIntroUrl: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    if (!formData.title.trim() || !formData.bio.trim()) {
      addToast('Please provide your mentor title and teaching biography.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const expertiseList = formData.expertise
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      await dbService.createMentorApplication({
        userId: currentUser.id,
        fullName: currentUser.full_name || 'Applicant',
        email: currentUser.email,
        title: formData.title,
        bio: formData.bio,
        yearsExperience: Number(formData.yearsExperience) || 0,
        expertise: expertiseList,
        resumeUrl: formData.resumeUrl,
        videoIntroUrl: formData.videoIntroUrl
      });

      setSubmitted(true);
      addToast('Mentor application submitted successfully for review!', 'success');
      if (onSubmitted) onSubmitted();
    } catch (err) {
      addToast(err.message || 'Failed to submit mentor application.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Apply to Become a SayBD Mentor">
      {submitted ? (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 flex items-center justify-center">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Application Under Review
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Thank you for applying to teach on SayBD! Our administrator reviews applications within 24-48 hours. You will receive an on-platform notification once approved.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-start gap-2.5 text-indigo-900 dark:text-indigo-200">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[11px]">Teach English & Earn Real Income</p>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                Host live group classrooms, publish structured courses, and withdraw verified earnings via bKash, Nagad, or Bank Transfer.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Professional Title / Specialty *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Senior IELTS Coach & Accent Specialist"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Years of Teaching Experience
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={formData.yearsExperience}
                onChange={(e) => setFormData(prev => ({ ...prev, yearsExperience: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Areas of Expertise (Comma Separated)
              </label>
              <input
                type="text"
                value={formData.expertise}
                onChange={(e) => setFormData(prev => ({ ...prev, expertise: e.target.value }))}
                placeholder="IELTS, Accent, Business English"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Teaching Biography & Experience *
            </label>
            <textarea
              required
              rows={3}
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="Describe your background, teaching philosophy, and student success track record..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Resume / Portfolio Link (Optional)
              </label>
              <input
                type="url"
                value={formData.resumeUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, resumeUrl: e.target.value }))}
                placeholder="https://linkedin.com/in/... or drive link"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Intro Video Link (Optional)
              </label>
              <input
                type="url"
                value={formData.videoIntroUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, videoIntroUrl: e.target.value }))}
                placeholder="YouTube, Loom or Drive URL"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {submitting ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Application</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
