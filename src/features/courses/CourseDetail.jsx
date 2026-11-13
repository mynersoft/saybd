import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { CheckoutModal } from '../payments/CheckoutModal.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import {
  BookOpen,
  Check,
  Star,
  Users,
  PlayCircle,
  FileText,
  Lock,
  Shield,
  ArrowLeft,
  Sparkles,
  Award,
  MessageSquare
} from 'lucide-react';

export function CourseDetail({ course, isEnrolled, onBack, onStartLearning }) {
  const { currentUser } = useAuth();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    async function fetchReviews() {
      if (course?.id) {
        const revs = await dbService.getCourseReviews(course.id);
        setReviews(revs);
      }
    }
    fetchReviews();
  }, [course?.id]);

  const totalLessons = course.sections?.reduce((acc, sec) => acc + (sec.lessons?.length || 0), 0) || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to All Courses</span>
      </button>

      {/* Hero Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
              {course.category}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-semibold">{course.level}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">
            {course.title}
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {course.subtitle}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2">
            <div className="flex items-center gap-1 text-amber-500 font-bold">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{course.rating ? Number(course.rating).toFixed(1) : (reviews.length > 0 ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : 'New')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{course.total_enrollments} Students Enrolled</span>
            </div>
            <div className="flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              <span>{totalLessons} Practical Video Lessons</span>
            </div>
          </div>

          {/* Instructor Bio */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <img
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200"
              alt={course.mentor_name}
              className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-500/20"
            />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                Instructor: {course.mentor_name}
                <Shield className="w-3 h-3 text-indigo-500" />
              </p>
              <span className="text-[11px] text-slate-400">Certified Cambridge English Coach</span>
            </div>
          </div>
        </div>

        {/* Right Checkout Card */}
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="relative rounded-xl overflow-hidden aspect-video mb-4 shadow-sm">
              <img
                src={course.thumbnail_url || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&auto=format&fit=crop&q=80'}
                alt={course.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center">
                <PlayCircle className="w-12 h-12 text-white/90" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                {formatCurrency(course.price_cents, course.currency)}
              </span>
              <span className="text-xs text-slate-400 line-through">৳2,500</span>
            </div>

            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-4">
              ✓ Full lifetime access & certificate of completion
            </p>
          </div>

          {isEnrolled ? (
            <button
              onClick={onStartLearning}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all hover:scale-102"
            >
              Resume Learning Dashboard →
            </button>
          ) : (
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all hover:scale-102"
            >
              Enroll Now with bKash / Nagad / Card
            </button>
          )}
        </div>

      </div>

      {/* Curriculum Preview */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Course Curriculum & Lesson Plan
        </h3>

        <div className="space-y-4">
          {course.sections.map((sec, secIdx) => (
            <div key={sec.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <h5 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Section {secIdx + 1}: {sec.title}
              </h5>

              <div className="space-y-2">
                {sec.lessons.map((les) => (
                  <div
                    key={les.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <PlayCircle className="w-4 h-4 text-indigo-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{les.title}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">{les.duration}</span>
                      {les.is_preview ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Free Preview
                        </span>
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Student Reviews & Ratings */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              <span>Student Reviews & Ratings</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified feedback from learners enrolled in this masterclass.
            </p>
          </div>
          <span className="text-xs font-bold text-amber-500">
            ★ {reviews.length > 0 ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : (course.rating ? Number(course.rating).toFixed(1) : 'New')} ({reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'})
          </span>
        </div>

        <div className="space-y-3">
          {reviews.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No reviews yet for this course.</p>
          ) : (
            reviews.map((rev) => (
              <div
                key={rev.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={rev.student_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
                      alt={rev.student_name}
                      className="w-7 h-7 rounded-lg object-cover"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{rev.student_name}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(rev.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-slate-600 dark:text-slate-300 leading-relaxed pl-9">
                  {rev.review_text}
                </p>

                {rev.mentor_reply && (
                  <div className="ml-9 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px]">
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 block">
                      Instructor Response:
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                      {rev.mentor_reply}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        item={course}
        currentUser={currentUser}
        onPaymentSuccess={() => {
          setIsCheckoutOpen(false);
          onStartLearning && onStartLearning();
        }}
      />
    </div>
  );
}
