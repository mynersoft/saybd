import React, { useState, useEffect, useCallback } from 'react';
import { dbService, getDhakaDateString } from '../../services/supabase/dbService.js';
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { ShareProgressModal } from './ShareProgressModal.jsx';

export function MonthlyPracticeCalendar({ userId, studentName = 'Student' }) {
  // Current date in Asia/Dhaka timezone
  const todayStr = getDhakaDateString(); // e.g. "2026-11-08"
  const [currentYear, setCurrentYear] = useState(() => parseInt(todayStr.split('-')[0], 10) || 2026);
  const [currentMonth, setCurrentMonth] = useState(() => parseInt(todayStr.split('-')[1], 10) || 11); // 1-12
  const [practiceData, setPracticeData] = useState({});
  const [loading, setLoading] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const todayDay = parseInt(todayStr.split('-')[2], 10);
  const todayMonthNum = parseInt(todayStr.split('-')[1], 10);
  const todayYearNum = parseInt(todayStr.split('-')[0], 10);

  // Month names for heading
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Load monthly 1-on-1 speaking practice data from Supabase
  const loadPracticeData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await dbService.getMonthlySpeakingPractice(userId, currentYear, currentMonth);
      setPracticeData(data || {});
    } finally {
      setLoading(false);
    }
  }, [userId, currentYear, currentMonth]);

  useEffect(() => {
    loadPracticeData();
  }, [loadPracticeData]);

  // Subscribe to real-time speaking updates
  useEffect(() => {
    const unsubscribe = dbService.subscribe(msg => {
      if (msg.type === 'usage_update' && msg.userId === userId) {
        loadPracticeData();
      }
    });
    return unsubscribe;
  }, [userId, loadPracticeData]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Calendar calculations
  // Weekday of the 1st day of the month (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay();
  // Total days in the month (e.g. 30 for November)
  const totalDays = new Date(currentYear, currentMonth, 0).getDate();

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-[#0b0d13] text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-2xl">
      {/* Top Title */}
      <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-4">
        Monthly Practice Time
      </h3>

      {/* Month & Year Header with Navigation Chevrons */}
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {monthNames[currentMonth - 1]} {currentYear}
        </h2>

        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Previous Month"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Next Month"
            aria-label="Next Month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Weekdays Row: Sun Mon Tue Wed Thu Fri Sat */}
      <div className="grid grid-cols-7 gap-2 sm:gap-2.5 mb-2.5 text-center">
        {weekdays.map(day => (
          <div key={day} className="text-xs font-semibold text-slate-400 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
        {/* Empty cells before month begins */}
        {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
          <div key={`empty-${idx}`} className="h-16 sm:h-20" />
        ))}

        {/* Days of the Month */}
        {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
          const minutes = practiceData[day] || 0;
          const isToday =
            currentYear === todayYearNum &&
            currentMonth === todayMonthNum &&
            day === todayDay;

          const isFullPractice = minutes >= 20;

          // Card background styling based on reference screenshot
          let cellBgClass = 'bg-[#1a1d26] border border-[#232733] hover:bg-[#222633]';
          if (isFullPractice) {
            cellBgClass = 'bg-[#062412] border border-[#0d4724] shadow-xs';
          } else if (isToday) {
            cellBgClass = 'bg-[#082a16] border border-emerald-600/60 shadow-xs';
          }

          return (
            <div
              key={day}
              className={`rounded-2xl p-2 sm:p-2.5 min-h-[66px] sm:min-h-[76px] flex flex-col items-center justify-between transition-all ${cellBgClass}`}
            >
              {/* Day Number */}
              <span
                className={`text-sm sm:text-base ${
                  isToday
                    ? 'text-emerald-400 font-extrabold'
                    : 'text-white font-semibold'
                }`}
              >
                {day}
              </span>

              {/* Practice Duration (e.g. 8m, 20m, 12m or '-' if none) */}
              <span
                className={`text-xs ${
                  isFullPractice || isToday
                    ? 'text-emerald-400 font-bold'
                    : minutes > 0
                    ? 'text-slate-200 font-semibold'
                    : 'text-slate-500 font-medium'
                }`}
              >
                {minutes > 0 ? `${minutes}m` : '–'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Practice Duration Caption */}
      <div className="text-xs text-slate-400 mt-5 pt-3 border-t border-slate-900/80 flex items-center justify-between">
        <span>Daily 1-on-1 Practice Duration</span>
        <span className="text-[11px] text-slate-500 hidden sm:inline">Asia/Dhaka Timezone</span>
      </div>

      {/* Share My Progress Action Section */}
      <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-400 text-center sm:text-left">
          <span>Share your {monthNames[currentMonth - 1]} {currentYear} English speaking consistency</span>
        </div>

        <button
          type="button"
          onClick={() => setIsShareModalOpen(true)}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all hover:scale-102 active:scale-95"
        >
          <Share2 className="w-4 h-4" />
          <span>Share My Progress</span>
        </button>
      </div>

      {/* Share Progress Modal */}
      <ShareProgressModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        studentName={studentName}
        monthName={monthNames[currentMonth - 1]}
        monthNumber={currentMonth}
        year={currentYear}
        practiceData={practiceData}
      />
    </div>
  );
}
