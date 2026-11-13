import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import {
  Mic,
  BookOpen,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award,
  Video,
  CheckCircle2,
  Bell,
  Play
} from 'lucide-react';
import { MonthlyPracticeCalendar } from '../../components/speaking/MonthlyPracticeCalendar.jsx';
import { MentorApplicationModal } from '../mentor/MentorApplicationModal.jsx';


export function StudentOverview({ onNavigateTab }) {
  const { currentUser, usage, remainingSeconds, maxAllowanceSeconds } = useAuth();
  const [stats, setStats] = useState({
    upcomingClasses: [],
    enrolledCourses: [],
    recentHistory: [],
    announcements: []
  });
  const [loading, setLoading] = useState(true);
  const [isMentorAppOpen, setIsMentorAppOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadStudentData() {
      try {
        setLoading(true);
        const [classes, purchasedCourses, history, announcements] = await Promise.all([
          dbService.getClasses(),
          dbService.getPurchasedCourses(currentUser?.id),
          dbService.getPracticeHistory(currentUser?.id),
          dbService.getAnnouncements('student')
        ]);

        if (mounted) {
          const upcoming = (classes || []).filter(c => c.status === 'scheduled' || c.status === 'live');
          setStats({
            upcomingClasses: upcoming.slice(0, 3),
            enrolledCourses: purchasedCourses || [],
            recentHistory: (history || []).slice(0, 3),
            announcements: (announcements || []).slice(0, 2)
          });
        }
      } catch (err) {
        console.error('Error loading student dashboard data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadStudentData();
    return () => { mounted = false; };
  }, [currentUser?.id]);

  const dailyMinutesAllowed = Math.floor((maxAllowanceSeconds || 1200) / 60);
  const minutesUsedToday = Math.floor((usage?.usedSeconds || 0) / 60);
  const remainingMinutes = Math.max(0, Math.floor(remainingSeconds / 60));
  const allowancePercent = Math.min(100, Math.round(((usage?.usedSeconds || 0) / (maxAllowanceSeconds || 1200)) * 100));

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Welcome back to SayBD</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Hi, {currentUser?.full_name || 'Speaking Learner'}!
          </h2>
          <p className="mt-2 text-sm text-emerald-100 leading-relaxed">
            Ready to improve your spoken fluency today? You have{' '}
            <strong className="text-white font-bold">{remainingMinutes} minutes</strong> remaining in today's daily 1-on-1 speaking allowance. Resets daily at midnight (Asia/Dhaka).
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('find-partner')}
              className="px-5 py-2.5 rounded-xl bg-white text-emerald-700 font-semibold text-xs sm:text-sm hover:bg-emerald-50 transition-all shadow-sm flex items-center gap-2"
            >
              <Mic className="w-4 h-4" />
              <span>Start 1-on-1 Practice</span>
            </button>
            <button
              onClick={() => onNavigateTab('browse-courses')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm transition-all border border-white/20 flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>Browse Courses</span>
            </button>
            {currentUser?.role === 'student' && (
              <button
                onClick={() => setIsMentorAppOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-slate-900" />
                <span>Apply as Mentor</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background shape */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      </div>

      {/* Daily Allowance & Quick KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Daily Speaking Time */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Today's Allowance</span>
              <Clock className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {remainingMinutes}m
              </span>
              <span className="text-xs text-slate-500">of {dailyMinutesAllowed}m left</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${allowancePercent}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Used {minutesUsedToday} mins • Dhaka Timezone
          </p>
        </div>

        {/* Card 2: Total Practice Time */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Practice</span>
              <TrendingUp className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {currentUser?.total_speaking_minutes ?? 0}
              </span>
              <span className="text-xs text-slate-500">minutes recorded</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Ranked on regional leaderboard
          </p>
        </div>

        {/* Card 3: Active Streak */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Practice Streak</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {currentUser?.streak_days ?? 0}
              </span>
              <span className="text-xs text-slate-500">consecutive days</span>
            </div>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-3 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Keep it going today!
          </p>
        </div>

        {/* Card 4: Plan Status */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Plan & Tier</span>
              <Award className="w-4 h-4 text-purple-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-white capitalize">
                {currentUser?.plan || 'Free'}
              </span>
              <span className="text-xs text-slate-500">Member</span>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('subscription')}
            className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline text-left mt-3 flex items-center gap-1"
          >
            Manage subscription →
          </button>
        </div>
      </div>

      {/* Main Grid: Left side upcoming classes & enrolled courses; Right side calendar & announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Live Classes */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Upcoming Live Classes
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('upcoming-classes')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {stats.upcomingClasses.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.upcomingClasses.map((cls) => (
                  <div key={cls.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          {cls.category || 'Spoken English'}
                        </span>
                        {cls.status === 'live' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                            LIVE NOW
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                        {cls.title}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{cls.schedule_date || 'Upcoming'}</span>
                        <span>•</span>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{cls.start_time || '8:00 PM'} - {cls.end_time || '9:00 PM'} (Dhaka)</span>
                      </p>
                    </div>

                    <button
                      onClick={() => onNavigateTab('upcoming-classes')}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 self-start sm:self-center transition-colors shadow-sm"
                    >
                      {cls.status === 'live' ? 'Join Live Now' : 'Class Details'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-sm">
                No scheduled classes right now. Check back soon!
              </div>
            )}
          </div>

          {/* Enrolled Courses & Progress */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  My Learning Courses
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('my-courses')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                Go to Courses <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.enrolledCourses.map((course) => (
                <div
                  key={course.id}
                  className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {course.level || 'Intermediate'}
                    </span>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mt-2 line-clamp-1">
                      {course.title}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {course.description || 'Master conversational English fluency through practical exercises.'}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {course.sections?.reduce((acc, s) => acc + (s.lessons?.length || 0), 0) || course.total_lessons || 0} Lessons
                    </span>
                    <button
                      onClick={() => onNavigateTab('my-courses')}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                    >
                      <Play className="w-3 h-3" /> Resume
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Practice Calendar & Announcements */}
        <div className="space-y-6">
          {/* Practice Calendar Widget */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Practice Attendance
              </h3>
            </div>
            <MonthlyPracticeCalendar />
          </div>

          {/* Platform Announcements */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-amber-500" />
              SayBD Notice Board
            </h3>
            <div className="space-y-3">
              {stats.announcements.map((ann) => (
                <div key={ann.id} className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-900/40">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    {ann.title}
                  </p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1">
                    {ann.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <MentorApplicationModal
        isOpen={isMentorAppOpen}
        onClose={() => setIsMentorAppOpen(false)}
      />
    </div>
  );
}
