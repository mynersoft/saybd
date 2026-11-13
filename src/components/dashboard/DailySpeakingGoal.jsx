import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import {
  Flame,
  Mic,
  Sparkles,
  Trophy,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Settings2
} from 'lucide-react';

export function DailySpeakingGoal() {
  const { currentUser, usage, refreshUsage } = useAuth();

  // Custom daily goal target in minutes (default: 20 minutes)
  const [goalMinutes, setGoalMinutes] = useState(() => {
    if (typeof window !== 'undefined' && currentUser?.id) {
      const saved = localStorage.getItem(`saybd_daily_goal_target_${currentUser.id}`) || localStorage.getItem(`speakmate_daily_goal_target_${currentUser.id}`);
      if (saved) return parseInt(saved, 10) || 20;
    }
    return 20;
  });

  const [streakData, setStreakData] = useState({
    currentStreak: 5,
    bestStreak: 14,
    recentDays: []
  });
  const [loading, setLoading] = useState(false);

  // Minutes practiced today from real-time daily usage table
  const usedSeconds = usage?.usedSeconds || 0;
  const minutesPracticed = Math.floor(usedSeconds / 60);
  const secondsRemainder = usedSeconds % 60;

  // Percentage of daily goal completed (capped at 100 for circle offset, but display actual)
  const percentCompleted = Math.min(100, Math.round((minutesPracticed / goalMinutes) * 100));
  const isGoalReached = minutesPracticed >= goalMinutes;

  // SVG circular progress calculation
  // Radius = 46, Circumference = 2 * PI * 46 = 289.02
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentCompleted / 100) * circumference;

  // Load streak from dbService
  const loadStreak = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const data = await dbService.getSpeakingStreak(currentUser.id);
      setStreakData(data);
    } catch (err) {
      console.warn('Could not fetch streak:', err);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadStreak();
  }, [loadStreak, usedSeconds]);

  // Subscribe to live usage updates across tabs or calls
  useEffect(() => {
    const unsubscribe = dbService.subscribe((msg) => {
      if (msg.type === 'usage_update' && msg.userId === currentUser?.id) {
        refreshUsage && refreshUsage(currentUser.id);
        loadStreak();
      }
    });
    return unsubscribe;
  }, [currentUser?.id, refreshUsage, loadStreak]);

  // Handle goal change
  const handleSelectGoal = (mins) => {
    setGoalMinutes(mins);
    if (typeof window !== 'undefined' && currentUser?.id) {
      localStorage.setItem(`saybd_daily_goal_target_${currentUser.id}`, mins.toString());
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-indigo-50/20 to-blue-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 p-4 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-md">
      
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
        
        {/* Left Section: Circular Progress Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
          
          {/* Animated SVG Circular Progress */}
          <div className="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              {/* Background Ring Track */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-slate-200 dark:stroke-slate-800 fill-none"
                strokeWidth="9"
              />

              {/* Gradient Definition */}
              <defs>
                <linearGradient id="goalProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={isGoalReached ? '#10B981' : '#6366F1'} />
                  <stop offset="100%" stopColor={isGoalReached ? '#34D399' : '#3B82F6'} />
                </linearGradient>
              </defs>

              {/* Progress Stroke */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="url(#goalProgressGradient)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700 ease-out"
              />
            </svg>

            {/* Inner Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {isGoalReached ? (
                <div className="flex flex-col items-center animate-in zoom-in-75 duration-300">
                  <Trophy className="w-6 h-6 text-emerald-500 mb-0.5 animate-bounce" />
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">100%</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Goal Met!
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="flex items-baseline">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {minutesPracticed}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">/{goalMinutes}m</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {percentCompleted}% Done
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Goal Description & Quick Adjuster */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              <Clock className="w-3.5 h-3.5" />
              <span>Daily Speaking Goal</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {isGoalReached
                ? 'Daily Goal Achieved! 🎉'
                : `${Math.max(0, goalMinutes - minutesPracticed)} mins remaining today`}
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              {isGoalReached
                ? 'Fantastic work! You have completed your speaking goal for today. Extra practice builds even faster confidence!'
                : `Connect with speaking partners to hit your ${goalMinutes}-minute daily fluency target.`}
            </p>

            {/* Goal Duration Selector Pills */}
            <div className="flex items-center gap-1.5 pt-1 justify-center sm:justify-start">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Goal:</span>
              {[10, 15, 20, 30].map((mins) => (
                <button
                  key={mins}
                  onClick={() => handleSelectGoal(mins)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    goalMinutes === mins
                      ? 'bg-indigo-600 text-white shadow-xs scale-105'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Right Section: Streak Counter & Weekly Progress */}
        <div className="w-full lg:w-auto p-5 rounded-2xl bg-white/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-between space-y-4">
          
          {/* Streak Top Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-slate-900 dark:text-white">
                    {streakData.currentStreak} Days
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
                    Streak 🔥
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block -mt-0.5">
                  Best Record: <strong>{streakData.bestStreak} days</strong>
                </span>
              </div>
            </div>

            {/* Live Indicator */}
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Real-time
            </span>
          </div>

          {/* Past 7 Days Indicator Dots */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-2">
              <span>Past 7 Days Practice</span>
              <span className="text-indigo-600 dark:text-indigo-400">
                {streakData.recentDays.filter((d) => d.practiced).length}/7 Active
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {streakData.recentDays.map((day, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all ${
                    day.practiced
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300'
                      : day.isToday
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400'
                      : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-400'
                  }`}
                  title={`${day.date}: ${day.minutes}m practiced`}
                >
                  <span className="text-[10px] font-bold uppercase">{day.dayName}</span>
                  <div className="mt-1">
                    {day.practiced ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                    ) : (
                      <span className="text-[10px] font-bold opacity-60">•</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action CTA Button */}
          <Link
            to="/practice"
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 hover:scale-101 transition-all"
          >
            <Mic className="w-4 h-4 animate-pulse" />
            <span>{isGoalReached ? 'Practice More English' : 'Start Speaking Practice'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

        </div>

      </div>

    </div>
  );
}
