import React, { useState, useEffect } from 'react';
import {
  Play,
  CheckCircle2,
  Circle,
  FileText,
  Download,
  ArrowLeft,
  BookOpen,
  Sparkles,
  Award,
  Clock,
  ChevronRight,
  Star,
  MessageSquare,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import { Modal } from '../../components/common/Modal.jsx';

export function CoursePlayer({ course, onBack }) {
  const { currentUser } = useAuth();
  const { addToast } = useNotification();
  
  // Flatten all lessons for easy navigation
  const allLessons = course.sections?.flatMap(sec => 
    sec.lessons?.map(les => ({ ...les, sectionTitle: sec.title })) || []
  ) || [];

  const [activeLesson, setActiveLesson] = useState(allLessons[0] || null);
  const [completedLessonIds, setCompletedLessonIds] = useState(new Set([allLessons[0]?.id]));
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Load persistent student course progress
  useEffect(() => {
    async function loadProgress() {
      if (!currentUser?.id || !course?.id) return;
      try {
        const progress = await dbService.getCourseProgress(currentUser.id, course.id);
        if (progress?.completedLessons?.length > 0) {
          setCompletedLessonIds(new Set(progress.completedLessons));
        }
      } catch (err) {
        console.warn('Could not load course progress:', err);
      }
    }
    loadProgress();
  }, [currentUser?.id, course?.id]);

  const toggleLessonComplete = async (lessonId) => {
    const isCompleted = completedLessonIds.has(lessonId);
    const nextIsCompleted = !isCompleted;

    setCompletedLessonIds(prev => {
      const next = new Set(prev);
      if (nextIsCompleted) {
        next.add(lessonId);
        addToast('Lesson marked as completed! 🎉', 'success');
      } else {
        next.delete(lessonId);
      }
      return next;
    });

    if (currentUser?.id) {
      try {
        await dbService.updateLessonProgress(currentUser.id, course.id, lessonId, nextIsCompleted);
      } catch (err) {
        console.error('Failed to save lesson progress:', err);
      }
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewText.trim()) {
      addToast('Please enter your review feedback.', 'warning');
      return;
    }

    setIsSubmittingReview(true);
    try {
      await dbService.submitCourseReview({
        courseId: course.id,
        studentId: currentUser.id,
        rating,
        reviewText: reviewText.trim()
      });
      addToast('Thank you for rating this course! Your feedback was shared with the mentor.', 'success');
      setIsReviewModalOpen(false);
      setReviewText('');
    } catch (err) {
      addToast(err.message || 'Failed to submit review.', 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const progressPercentage = allLessons.length > 0
    ? Math.round((completedLessonIds.size / allLessons.length) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Course Marketplace</span>
        </button>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsReviewModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold shadow-xs hover:bg-amber-100"
          >
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>Rate Course</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Course Progress</span>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {progressPercentage}% Completed ({completedLessonIds.size}/{allLessons.length})
              </div>
            </div>
            <div className="w-24 bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Learning Classroom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Video Player & Active Content (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          
          <div className="relative rounded-3xl overflow-hidden bg-slate-950 aspect-video shadow-2xl border border-slate-800">
            {activeLesson?.video_url ? (
              <video
                key={activeLesson.id}
                src={activeLesson.video_url}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
                onEnded={() => toggleLessonComplete(activeLesson.id)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs p-6 text-center">
                <Play className="w-12 h-12 mb-2 text-slate-600" />
                <span className="font-semibold text-slate-300">{activeLesson?.title || 'Interactive Lesson'}</span>
                <span className="text-slate-500 text-[11px] mt-1">Review lecture materials and study notes below</span>
              </div>
            )}
          </div>

          {/* Lesson Info Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {activeLesson?.sectionTitle}
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {activeLesson?.title}
                </h2>
              </div>

              <button
                onClick={() => toggleLessonComplete(activeLesson?.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  completedLessonIds.has(activeLesson?.id)
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {completedLessonIds.has(activeLesson?.id) ? 'Completed ✓' : 'Mark as Complete'}
                </span>
              </button>
            </div>

            {/* Lesson Study Notes / Content Text */}
            {activeLesson?.content_text && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" /> Lesson Guide & Vocabulary Notes
                </h5>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {activeLesson.content_text}
                </div>
              </div>
            )}

            {/* Downloadable Resources */}
            {activeLesson?.resources && activeLesson.resources.length > 0 && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" /> Downloadable PDF Worksheets
                </h5>
                <div className="flex flex-wrap gap-2">
                  {activeLesson.resources.map((res, i) => (
                    <button
                      key={i}
                      onClick={() => addToast(`Downloading ${res}...`, 'info')}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{res}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Curriculum Sidebar (1 col) */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Course Syllabus
            </h4>
            <span className="text-xs text-slate-400">{allLessons.length} Lessons</span>
          </div>

          <div className="space-y-4 overflow-y-auto max-h-[600px] pr-1">
            {course.sections?.map((sec, secIdx) => (
              <div key={sec.id} className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Section {secIdx + 1}: {sec.title}
                </span>

                <div className="space-y-1.5">
                  {sec.lessons?.map((les) => {
                    const isSelected = activeLesson?.id === les.id;
                    const isCompleted = completedLessonIds.has(les.id);

                    return (
                      <button
                        key={les.id}
                        onClick={() => setActiveLesson({ ...les, sectionTitle: sec.title })}
                        className={`w-full p-3 rounded-2xl text-left text-xs transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 font-bold text-indigo-900 dark:text-indigo-200'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                          )}
                        </div>

                        <div className="flex-1 truncate">
                          <p className="truncate">{les.title}</p>
                          <span className="text-[10px] text-slate-400 font-normal mt-0.5 block flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {les.duration}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Leave Course Review Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Leave Course Review & Feedback"
      >
        <form onSubmit={handleSubmitReview} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Share your feedback for <strong>{course.title}</strong> by {course.mentor_name}. Your review helps other students.
          </p>

          {/* Star selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Star Rating
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 rounded-lg hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-bold text-amber-500 ml-2">
                {rating} out of 5 stars
              </span>
            </div>
          </div>

          {/* Text feedback */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Your Review & Comments
            </label>
            <textarea
              required
              rows={4}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="What did you like about this course? How did it help your speaking or IELTS preparation?"
              className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingReview}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
