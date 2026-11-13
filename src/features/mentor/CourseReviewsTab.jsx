import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/supabase/dbService.js';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { formatDate } from '../../utils/formatters.js';
import {
  Star,
  MessageSquare,
  Send,
  Flag,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from 'lucide-react';

export function CourseReviewsTab({ mentorId }) {
  const { addToast } = useNotification();
  const [reviews, setReviews] = useState([]);
  const [replyInputs, setReplyInputs] = useState({});
  const [submittingReply, setSubmittingReply] = useState(null);
  const [ratingFilter, setRatingFilter] = useState('all');

  const loadReviews = async () => {
    if (!mentorId) return;
    const list = await dbService.getAllMentorReviews(mentorId);
    setReviews(list);
  };

  useEffect(() => {
    loadReviews();
  }, [mentorId]);

  const handleSendResponse = async (reviewId) => {
    const text = replyInputs[reviewId];
    if (!text || !text.trim()) {
      addToast('Please enter a response message.', 'error');
      return;
    }

    setSubmittingReply(reviewId);
    try {
      await dbService.respondToCourseReview(reviewId, text);
      addToast('Response published! Student notified.', 'success');
      setReplyInputs({ ...replyInputs, [reviewId]: '' });
      loadReviews();
    } catch (err) {
      addToast(err.message || 'Failed to submit response.', 'error');
    } finally {
      setSubmittingReply(null);
    }
  };

  const handleReport = async (reviewId) => {
    if (!confirm('Report this review to platform administrators for review?')) return;
    try {
      await dbService.reportCourseReview(reviewId, 'Flagged by instructor for moderation');
      addToast('Review reported to administrators.', 'info');
      loadReviews();
    } catch (err) {
      addToast('Failed to report review.', 'error');
    }
  };

  const filtered = reviews.filter(r => {
    if (ratingFilter === 'all') return true;
    return r.rating === Number(ratingFilter);
  });

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviews.length).toFixed(1)
    : '5.0';

  return (
    <div className="space-y-6">
      
      {/* Review KPI Summary Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-900 text-center">
            <span className="text-3xl font-black text-amber-500 font-mono block">
              {avgRating}
            </span>
            <div className="flex items-center justify-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map(star => (
                <Star key={star} className="w-3 h-3 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">Instructor Average</span>
          </div>

          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Student Ratings & Reviews
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Read authentic feedback from verified enrolled students and respond directly to questions.
            </p>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">
              {reviews.length} Verified Student Reviews
            </span>
          </div>
        </div>

        {/* Filter by star rating */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          {['all', '5', '4', '3'].map(f => (
            <button
              key={f}
              onClick={() => setRatingFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                ratingFilter === f
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {f === 'all' ? 'All Reviews' : `${f} Stars`}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews Feed */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
            No student reviews match the selected filter.
          </div>
        ) : (
          filtered.map(r => (
            <div
              key={r.id}
              className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={r.student_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.student_id}`}
                    alt={r.student_name}
                    className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                  />
                  <div>
                    <h5 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {r.student_name}
                    </h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= r.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300 dark:text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleReport(r.id)}
                  className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] flex items-center gap-1"
                  title="Report abusive or inappropriate review"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Report</span>
                </button>
              </div>

              {/* Review Content */}
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs sm:text-sm pl-1">
                "{r.review_text}"
              </p>

              {/* Mentor Existing Response */}
              {r.mentor_response ? (
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-indigo-700 dark:text-indigo-300">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Instructor Response</span>
                    </span>
                    <span className="text-[10px] opacity-75 font-normal">
                      {formatDate(r.mentor_responded_at)}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {r.mentor_response}
                  </p>
                </div>
              ) : (
                /* Reply Form */
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                  <input
                    type="text"
                    value={replyInputs[r.id] || ''}
                    onChange={(e) => setReplyInputs({ ...replyInputs, [r.id]: e.target.value })}
                    placeholder="Write a public response to this student review..."
                    className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={() => handleSendResponse(r.id)}
                    disabled={submittingReply === r.id}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs flex items-center gap-1.5 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingReply === r.id ? 'Sending...' : 'Reply'}</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
}
