import React, { useState, useEffect, useCallback } from 'react';
import { dbService, getDhakaMonthName, getDhakaYear } from '../../services/supabase/dbService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { formatSpeakingDuration } from '../../utils/formatters.js';
import { TopThreeShareModal } from './TopThreeShareModal.jsx';
import {
  Trophy,
  Medal,
  Crown,
  Calendar,
  Clock,
  Share2,
  Sparkles,
  ChevronRight,
  Shield,
  User,
  Users,
  ChevronDown,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export function SpeakingLeaderboard() {
  const { currentUser, isAdmin } = useAuth();
  const { addToast } = useNotification();

  // Period filter: 'today' | 'monthly' | 'yearly'
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleLimit, setVisibleLimit] = useState(10);
  const [userRankData, setUserRankData] = useState(null);

  // Share Top 3 modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Determine current readable period titles
  const monthName = getDhakaMonthName();
  const currentYear = getDhakaYear();

  const periodLabels = {
    today: "Today's Top Speakers",
    monthly: `Monthly Champions • ${monthName} ${currentYear}`,
    yearly: `Yearly Champions • ${currentYear}`,
  };

  const periodDescriptions = {
    today: "Speaking time logged today between 12:00 AM – 11:59 PM (Asia/Dhaka). Resets daily at midnight.",
    monthly: `Speaking time accumulated across the calendar month of ${monthName} ${currentYear}. Resets on the 1st.`,
    yearly: `Annual practice speaking champion standings for ${currentYear}. Resets on January 1st.`,
  };

  // Fetch leaderboard data for the selected period
  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await dbService.getSpeakingLeaderboard(selectedPeriod, 50, 0);
      setLeaderboardData(result.students || []);
      setTotalCount(result.totalCount || 0);

      // Fetch user's personal rank if student
      if (currentUser?.id) {
        const myRank = await dbService.getUserRank(currentUser.id, selectedPeriod);
        setUserRankData(myRank);
      }
    } catch (err) {
      console.error('Failed to load speaking leaderboard:', err);
      addToast('Could not refresh leaderboard rankings.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod, currentUser?.id, addToast]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Subscribe to real-time session completions across tabs
  useEffect(() => {
    const unsubscribe = dbService.subscribe((msg) => {
      if (msg.type === 'leaderboard_update' || msg.type === 'usage_update' || (msg.type === 'table_update' && msg.table === 'profiles')) {
        fetchLeaderboard();
      }
    });
    return unsubscribe;
  }, [fetchLeaderboard]);

  // Top 3 students
  const topThree = leaderboardData.slice(0, 3);
  // Remaining students (rank 4 to visibleLimit)
  const remainingList = leaderboardData.slice(3, visibleLimit);
  const hasMore = visibleLimit < leaderboardData.length;

  const handleLoadMore = () => {
    setVisibleLimit((prev) => prev + 10);
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* 1. Header Hero Card with Period Filter & Share CTA */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
        
        {/* Title and Tagline */}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold ring-1 ring-amber-500/30 shrink-0">
              <Trophy className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Speaking Leaderboard
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  Dhaka
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ranks students exclusively by verified 1-on-1 English speaking practice time.
              </p>
            </div>
          </div>
        </div>

        {/* Share Top 3 CTA Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all hover:scale-102 active:scale-95"
            title="Generate and share social-ready Top 3 image"
          >
            <Share2 className="w-4 h-4 text-slate-950" />
            <span>Share Top 3</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-900" />
          </button>
        </div>

      </div>

      {/* 2. Three Ranking Period Filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-wider text-slate-400">
            Select Ranking Period
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Classroom & webinar time is strictly excluded
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800">
          
          {/* Today Button */}
          <button
            type="button"
            onClick={() => setSelectedPeriod('today')}
            className={`py-2 sm:py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
              selectedPeriod === 'today'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
            <span>Today</span>
          </button>

          {/* Monthly Button */}
          <button
            type="button"
            onClick={() => setSelectedPeriod('monthly')}
            className={`py-2 sm:py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
              selectedPeriod === 'monthly'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
            <span>Monthly</span>
          </button>

          {/* Yearly Button */}
          <button
            type="button"
            onClick={() => setSelectedPeriod('yearly')}
            className={`py-2 sm:py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
              selectedPeriod === 'yearly'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
            <span>Yearly</span>
          </button>

        </div>

        {/* Current Period Info Notice */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>{periodDescriptions[selectedPeriod]}</span>
        </div>
      </div>

      {/* 3. Student's Own Current Ranking (Sticky Banner / Card) */}
      {currentUser?.role === 'student' && userRankData && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/40 border border-indigo-500/30 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
              alt={currentUser.full_name}
              className="w-12 h-12 rounded-2xl object-cover ring-2 ring-indigo-500/40 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">Your Current Standings:</span>
                {userRankData.rank ? (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                    userRankData.rank === 1 ? 'bg-amber-400 text-slate-950' :
                    userRankData.rank === 2 ? 'bg-slate-300 text-slate-950' :
                    userRankData.rank === 3 ? 'bg-amber-700 text-white' :
                    'bg-indigo-600 text-white'
                  }`}>
                    Rank #{userRankData.rank}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400">
                    Not Ranked Yet
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-white mt-0.5">
                {userRankData.full_name} • {formatSpeakingDuration(userRankData.speaking_seconds)} practiced
              </p>
            </div>
          </div>

          {/* Position relative to Top 3 */}
          <div className="text-left sm:text-right text-xs">
            {userRankData.isInTop3 ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-xl border border-amber-400/30">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>You are in the Top 3 Champions! 🏆</span>
              </span>
            ) : userRankData.diffToTop3Seconds > 0 ? (
              <div className="space-y-0.5">
                <span className="text-slate-400">Distance to Top 3:</span>
                <p className="font-bold text-indigo-400">
                  +{formatSpeakingDuration(userRankData.diffToTop3Seconds)} needed to enter Top 3
                </p>
              </div>
            ) : (
              <span className="text-slate-400">
                Practice 1-on-1 English today to earn your rank!
              </span>
            )}
          </div>
        </div>
      )}

      {/* 4. Top 3 Prominent Podium Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Top 3 Champions</span>
            <span className="text-xs font-semibold text-slate-400">({periodLabels[selectedPeriod]})</span>
          </h2>
        </div>

        {topThree.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs sm:text-sm">
            No verified speaking sessions recorded for this period yet. Start practicing to take the #1 spot!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Rank 1: Gold Medal */}
            {topThree[0] && (
              <div className="relative order-1 md:order-2 p-6 rounded-3xl bg-gradient-to-b from-amber-500/10 via-white to-white dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 border-2 border-amber-500/60 shadow-xl flex flex-col items-center text-center space-y-4 transform md:-translate-y-2">
                <div className="absolute -top-3.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[11px] shadow-md flex items-center gap-1.5 uppercase tracking-wider">
                  <Crown className="w-3.5 h-3.5 fill-current" />
                  <span>Rank #1 • Gold</span>
                </div>

                <div className="relative mt-2">
                  {topThree[0].avatar_url ? (
                    <img
                      src={topThree[0].avatar_url}
                      alt={topThree[0].full_name}
                      className="w-24 h-24 rounded-3xl object-cover ring-4 ring-amber-400 shadow-xl"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-3xl bg-amber-500/20 text-amber-500 font-extrabold text-3xl flex items-center justify-center ring-4 ring-amber-400 shadow-xl">
                      {topThree[0].full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-md">
                    🥇
                  </div>
                </div>

                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white truncate max-w-[200px]">
                    {topThree[0].full_name}
                  </h3>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Verified Student
                  </span>
                </div>

                <div className="w-full pt-3 border-t border-amber-500/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Speaking Time
                  </span>
                  <span className="font-black text-2xl text-amber-500">
                    {formatSpeakingDuration(topThree[0].speaking_seconds)}
                  </span>
                </div>
              </div>
            )}

            {/* Rank 2: Silver Medal */}
            {topThree[1] && (
              <div className="relative order-2 md:order-1 p-6 rounded-3xl bg-gradient-to-b from-slate-200/40 via-white to-white dark:from-slate-700/20 dark:via-slate-900 dark:to-slate-900 border border-slate-300 dark:border-slate-700 shadow-md flex flex-col items-center text-center space-y-4">
                <div className="absolute -top-3 px-3 py-0.5 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[10px] uppercase tracking-wider">
                  Rank #2 • Silver
                </div>

                <div className="relative mt-2">
                  {topThree[1].avatar_url ? (
                    <img
                      src={topThree[1].avatar_url}
                      alt={topThree[1].full_name}
                      className="w-20 h-20 rounded-3xl object-cover ring-4 ring-slate-300 dark:ring-slate-600 shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-3xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-2xl flex items-center justify-center ring-4 ring-slate-300 dark:ring-slate-600 shadow-md">
                      {topThree[1].full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-slate-300 text-slate-950 flex items-center justify-center font-black text-xs shadow-md">
                    🥈
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white truncate max-w-[200px]">
                    {topThree[1].full_name}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold block mt-0.5">
                    Verified Student
                  </span>
                </div>

                <div className="w-full pt-3 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Speaking Time
                  </span>
                  <span className="font-black text-xl text-slate-700 dark:text-slate-200">
                    {formatSpeakingDuration(topThree[1].speaking_seconds)}
                  </span>
                </div>
              </div>
            )}

            {/* Rank 3: Bronze Medal */}
            {topThree[2] && (
              <div className="relative order-3 p-6 rounded-3xl bg-gradient-to-b from-amber-800/10 via-white to-white dark:from-amber-900/15 dark:via-slate-900 dark:to-slate-900 border border-amber-700/30 dark:border-amber-800/40 shadow-md flex flex-col items-center text-center space-y-4">
                <div className="absolute -top-3 px-3 py-0.5 rounded-full bg-amber-700 text-white font-bold text-[10px] uppercase tracking-wider">
                  Rank #3 • Bronze
                </div>

                <div className="relative mt-2">
                  {topThree[2].avatar_url ? (
                    <img
                      src={topThree[2].avatar_url}
                      alt={topThree[2].full_name}
                      className="w-20 h-20 rounded-3xl object-cover ring-4 ring-amber-700/60 shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-3xl bg-amber-900/30 text-amber-500 font-extrabold text-2xl flex items-center justify-center ring-4 ring-amber-700/60 shadow-md">
                      {topThree[2].full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-amber-700 text-white flex items-center justify-center font-black text-xs shadow-md">
                    🥉
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white truncate max-w-[200px]">
                    {topThree[2].full_name}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold block mt-0.5">
                    Verified Student
                  </span>
                </div>

                <div className="w-full pt-3 border-t border-amber-800/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Speaking Time
                  </span>
                  <span className="font-black text-xl text-amber-700 dark:text-amber-500">
                    {formatSpeakingDuration(topThree[2].speaking_seconds)}
                  </span>
                </div>
              </div>
            )}

          </div>
        )}
      </section>

      {/* 5. Remaining Ranked Students Table / List (Ranks 4-10+) */}
      {remainingList.length > 0 && (
        <section className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              <span>Full Community Standings</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">
              Showing {Math.min(visibleLimit, leaderboardData.length)} of {totalCount} students
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {remainingList.map((student) => {
              const isCurrentUser = student.id === currentUser?.id;
              return (
                <div
                  key={student.id}
                  className={`py-3.5 px-3 rounded-2xl flex items-center justify-between gap-4 transition-colors ${
                    isCurrentUser
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-500/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Rank Badge */}
                    <span className="w-8 text-center font-mono font-bold text-xs text-slate-500 dark:text-slate-400">
                      #{student.rank}
                    </span>

                    {/* Avatar */}
                    <img
                      src={student.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
                      alt={student.full_name}
                      className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
                    />

                    {/* Name */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {student.full_name}
                        </p>
                        {isCurrentUser && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-600 text-white">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Verified Member
                      </span>
                    </div>
                  </div>

                  {/* Practice Duration */}
                  <div className="text-right shrink-0">
                    <span className="font-black text-sm text-slate-900 dark:text-white">
                      {formatSpeakingDuration(student.speaking_seconds)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Speaking time
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Load More Students
              </button>
            </div>
          )}
        </section>
      )}

      {/* 6. Top 3 Social Share Modal */}
      <TopThreeShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        period={selectedPeriod}
        periodLabel={periodLabels[selectedPeriod]}
        dateSubtitle={selectedPeriod === 'today' ? 'Asia/Dhaka Day' : selectedPeriod === 'monthly' ? `${monthName} ${currentYear}` : currentYear}
        topStudents={topThree}
      />

    </div>
  );
}
