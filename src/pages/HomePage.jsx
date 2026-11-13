import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatSecondsToTimer } from '../utils/formatters.js';
import { DailySpeakingGoal } from '../components/dashboard/DailySpeakingGoal.jsx';
import {
  Mic,
  Video,
  Users,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Radio,
  ArrowRight,
  Clock,
  Award,
  Star,
  CheckCircle2,
  TrendingUp,
  Globe2,
  Flame,
  Trophy
} from 'lucide-react';

export function HomePage() {
  const { currentUser, remainingSeconds, bonusMinutes, isApproved } = useAuth();

  return (
    <div className="space-y-10 pb-12">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-5 sm:p-10 lg:p-14 shadow-2xl border border-indigo-800/40">
        <div className="relative z-10 max-w-2xl space-y-4 sm:space-y-6">
          
          <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-xs font-bold bg-indigo-500/20 backdrop-blur-md border border-indigo-400/30 text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
            <span>Practice English. Connect. Improve.</span>
          </div>

          <h1 className="text-2xl xs:text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
            Speak English with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">Real People</span> Every Day
          </h1>

          <p className="text-xs sm:text-base text-slate-300 leading-relaxed max-w-xl">
            Overcome fear and hesitations. Get matched with approved community learners for 20 minutes of daily speaking practice, or join live classes hosted by expert mentors.
          </p>

          {/* Quick CTA Buttons */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 pt-2">
            <Link
              to="/practice"
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/30 hover:scale-102 transition-all flex items-center justify-center gap-2.5 sm:gap-3"
            >
              <Mic className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              <span>Start 1-on-1 Practice Now</span>
            </Link>

            <Link
              to="/classes"
              className="w-full sm:w-auto px-5 sm:px-6 py-3.5 sm:py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-white font-bold text-xs sm:text-sm border border-slate-700/80 backdrop-blur-md transition-all flex items-center justify-center gap-2"
            >
              <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>Join Live Classrooms</span>
            </Link>

            <Link
              to="/leaderboard"
              className="w-full sm:w-auto px-5 sm:px-6 py-3.5 sm:py-4 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs sm:text-sm border border-amber-500/40 backdrop-blur-md transition-all flex items-center justify-center gap-2"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Speaking Leaderboard</span>
            </Link>
          </div>

          {/* Daily Allowance Notice */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-400 pt-2">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>20 Minutes Free Daily Allowance</span>
            </div>
            <span className="hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Vetted & Approved Community</span>
            </div>
          </div>

        </div>

        {/* Ambient Gradient Blur */}
        <div className="absolute top-1/2 -right-16 -translate-y-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Daily Speaking Goal Component with Circular Progress & Streak */}
      <DailySpeakingGoal />

      {/* Dashboard Quick Stats Bar */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Remaining Free Time</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {formatSecondsToTimer(remainingSeconds)}
              </span>
              {bonusMinutes > 0 && (
                <span className="text-[11px] font-bold text-amber-500 font-mono">
                  (+{bonusMinutes}m bonus)
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400">Resets Asia/Dhaka 00:00</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center shrink-0 font-bold">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Speaking Habit</span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
              <span>Active Streak</span>
              <span className="text-xs">🔥</span>
            </p>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Daily Consistency</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center shrink-0 font-bold">
            <Radio className="w-6 h-6 text-amber-600 animate-pulse" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live Classes</span>
            <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              IELTS & Fluency
            </p>
            <span className="text-[10px] text-slate-400">With Certified Mentors</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center shrink-0 font-bold">
            <Globe2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Online Peers</span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
              12 Available
            </p>
            <span className="text-[10px] text-slate-400">Ready to Match</span>
          </div>
        </div>
      </section>

      {/* 4 Pillars Grid: Practice, Classes, Courses, Fluency */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            How SayBD Transforms Your English
          </h2>
          <span className="text-xs text-slate-400">Everything you need in one place</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: 1-on-1 Practice */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-indigo-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold">
                <Mic className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                1-on-1 Peer Matching
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Matched automatically with safe, approved students. 20 minutes free every day to talk about travel, career, and culture.
              </p>
            </div>
            <Link
              to="/practice"
              className="mt-6 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform"
            >
              <span>Start Speaking</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 2: Mentor Classrooms */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-indigo-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 flex items-center justify-center font-bold">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white group-hover:text-rose-600 transition-colors">
                Live Mentor Classrooms
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Interactive classes with Raise Hand and Open Discussion modes. Certified mentors guide accent, idioms, and speech structure.
              </p>
            </div>
            <Link
              to="/classes"
              className="mt-6 flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400 group-hover:translate-x-1 transition-transform"
            >
              <span>Explore Classrooms</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 3: Courses */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-indigo-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                Structured Courses
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Step-by-step masterclasses for IELTS Band 8, workplace conversations, and spontaneous thought formation with worksheets.
              </p>
            </div>
            <Link
              to="/courses"
              className="mt-6 flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform"
            >
              <span>Browse Courses</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>
      </section>

    </div>
  );
}
