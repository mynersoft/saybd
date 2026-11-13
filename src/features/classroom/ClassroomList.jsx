import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/supabase/dbService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { CreateClassModal } from './CreateClassModal.jsx';
import { LiveClassroom } from './LiveClassroom.jsx';
import { CheckoutModal } from '../payments/CheckoutModal.jsx';
import { CLASSROOM_MODES } from '../../config/constants.js';
import { formatDate } from '../../utils/formatters.js';
import {
  Users,
  Radio,
  Plus,
  Clock,
  Hand,
  Shield,
  Sparkles,
  Calendar,
  ChevronRight,
  Search,
  CheckCircle2,
  Lock,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

export function ClassroomList() {
  const { currentUser, isMentor } = useAuth();
  const { addToast } = useNotification();

  const [classes, setClasses] = useState([]);
  const [myUpcomingClasses, setMyUpcomingClasses] = useState([]);
  const [enrolledClassIds, setEnrolledClassIds] = useState(new Set());
  const [activeClassroom, setActiveClassroom] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [payingClass, setPayingClass] = useState(null);

  const categories = ['All', 'IELTS Exam Prep', 'Workplace English', 'Pronunciation', 'Conversational Fluency'];

  const loadClassesData = async () => {
    try {
      const [allClasses, myEnrolled] = await Promise.all([
        dbService.getLiveClasses(),
        currentUser?.id ? dbService.getStudentUpcomingClasses(currentUser.id) : []
      ]);
      setClasses(allClasses);
      setMyUpcomingClasses(myEnrolled);
      setEnrolledClassIds(new Set(myEnrolled.map(c => c.id)));
    } catch (err) {
      console.error('Error loading classroom list:', err);
    }
  };

  useEffect(() => {
    loadClassesData();
    // Auto-refresh access status countdowns every 30 seconds
    const interval = setInterval(loadClassesData, 30000);
    const unsub = dbService.subscribe((msg) => {
      if (['table_update', 'class_schedule_updated'].includes(msg.type)) {
        loadClassesData();
      }
    });
    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [currentUser?.id]);

  // Handle Free Class Enrollment
  const handleEnrollFree = async (cls) => {
    try {
      await dbService.enrollStudentInClass(cls.id, currentUser.id, null, 0);
      addToast(`Enrolled in "${cls.title}" for free! 🎉`, 'success');
      loadClassesData();
    } catch (err) {
      addToast(err.message || 'Failed to enroll in class.', 'error');
    }
  };

  // Filtered public class list
  const filtered = classes.filter(c => {
    const matchCat = selectedCategory === 'All' || c.category === selectedCategory;
    const matchSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mentor_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  if (activeClassroom) {
    return (
      <LiveClassroom
        classroom={activeClassroom}
        currentUser={currentUser}
        onLeaveClass={() => {
          setActiveClassroom(null);
          loadClassesData();
        }}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 mb-2">
            <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span>Live Interactive English Workshops</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            English Mentor Classrooms
          </h1>
          <p className="text-xs sm:text-sm text-indigo-100/80 mt-1 leading-relaxed">
            Practice speaking in small cohorts with certified native and Band 8.5+ mentors. Access opens 15 minutes before scheduled start time (Dhaka time).
          </p>
        </div>

        {isMentor && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Host New Class</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* STUDENT: MY UPCOMING ENROLLED CLASSES SECTION */}
      {/* ========================================================================= */}
      {myUpcomingClasses.length > 0 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 shadow-lg shadow-indigo-500/5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  My Upcoming Classes
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {myUpcomingClasses.length} Enrolled
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Join window opens 15 minutes prior to scheduled start. Classroom attendance does not consume your daily 1-on-1 minutes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myUpcomingClasses.map(cls => {
              const access = dbService.getClassroomAccessStatus(cls, currentUser.id, 'student');
              const isLive = cls.status === 'live';
              const canJoin = access.canJoin || isLive;

              return (
                <div
                  key={cls.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    canJoin
                      ? 'bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${access.badgeColor}`}>
                        {access.status}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {cls.duration_minutes}m
                      </span>
                    </div>

                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                      {cls.title}
                    </h3>

                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[11px] space-y-1">
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">Date:</span>
                        <span className="font-bold">{new Date(cls.scheduled_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">Time (Asia/Dhaka):</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {new Date(cls.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">Mentor:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{cls.mentor_name}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {access.message}
                    </p>
                  </div>

                  {/* Join Classroom Button */}
                  <div className="pt-4 mt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <button
                      onClick={() => setActiveClassroom(cls)}
                      disabled={!canJoin}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        isLive
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 animate-pulse'
                          : canJoin
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>
                        {isLive
                          ? 'Join Live Class Now 🎙️'
                          : canJoin
                          ? 'Enter Classroom Lounge'
                          : access.message}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PUBLIC AVAILABLE LIVE CLASSES CATALOG */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search classes or mentors..."
              className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Classes Grid */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 space-y-3">
            <Radio className="w-10 h-10 text-slate-400 mx-auto opacity-60" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {searchQuery ? 'No matching classes found' : 'No live workshops currently scheduled'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? 'Try a different search query or select another category.'
                : 'New mentor sessions are scheduled weekly. Certified mentors can create a new workshop above!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((c) => {
              const isLive = c.status === 'live';
            const isEnrolled = enrolledClassIds.has(c.id);
            const access = dbService.getClassroomAccessStatus(c, currentUser.id, isMentor && currentUser.id === c.mentor_id ? 'mentor' : 'student');
            const canJoin = access.canJoin || isLive;

            return (
              <div
                key={c.id}
                className={`p-6 rounded-3xl border transition-all flex flex-col justify-between ${
                  isLive
                    ? 'bg-white dark:bg-slate-900 border-indigo-500/40 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {isLive ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> Live Now
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          <Calendar className="w-3 h-3" /> Scheduled
                        </span>
                      )}

                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                        {c.speaking_mode === CLASSROOM_MODES.RAISE_HAND ? '✋ Raise Hand' : '🎙️ Open Discussion'}
                      </span>
                    </div>

                    <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                      {c.is_free ? 'Free' : `৳${c.price_bdt || 0} BDT`}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white leading-snug">
                    {c.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {c.description}
                  </p>

                  {/* Schedule Details */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-[11px] mt-4 space-y-1">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Date & Time:</span>
                      <span className="font-bold">
                        {new Date(c.scheduled_at).toLocaleDateString()} at {new Date(c.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Asia/Dhaka)
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Capacity:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {c.enrolled_count || 0} / {c.max_participants || 50} enrolled
                      </span>
                    </div>
                  </div>

                  {/* Mentor row */}
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <img
                      src={c.mentor_avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200'}
                      alt={c.mentor_name}
                      className="w-9 h-9 rounded-xl object-cover ring-2 ring-indigo-500/20"
                    />
                    <div>
                      <h5 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1">
                        {c.mentor_name}
                        <Shield className="w-3 h-3 text-indigo-500" />
                      </h5>
                      <span className="text-[10px] text-slate-400">Certified English Instructor</span>
                    </div>
                  </div>
                </div>

                {/* Enrollment & Action Button */}
                <div className="mt-5 pt-3">
                  {isEnrolled ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>You are Enrolled</span>
                      </div>

                      <button
                        onClick={() => setActiveClassroom(c)}
                        disabled={!canJoin && !isMentor}
                        className={`w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                          isLive
                            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 hover:scale-101 animate-pulse'
                            : canJoin || isMentor
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 hover:scale-101'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        <span>{isLive ? 'Join Live Classroom Now' : canJoin ? 'Enter Classroom Lounge' : access.message}</span>
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  ) : c.is_free ? (
                    <button
                      onClick={() => handleEnrollFree(c)}
                      className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all hover:scale-101"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Enroll in Free Class</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setPayingClass(c)}
                      className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-all hover:scale-101"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Enroll for ৳{c.price_bdt || 0} BDT</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Mentor Host Modal */}
      <CreateClassModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        mentor={currentUser}
        onClassCreated={(newClass) => {
          loadClassesData();
          setActiveClassroom(newClass);
        }}
      />

      {/* Paid Class Checkout Modal */}
      {payingClass && (
        <CheckoutModal
          isOpen={Boolean(payingClass)}
          onClose={() => setPayingClass(null)}
          item={payingClass}
          currentUser={currentUser}
          onPaymentSuccess={() => {
            setPayingClass(null);
            loadClassesData();
            addToast(`Successfully enrolled in ${payingClass.title}!`, 'success');
          }}
        />
      )}

    </div>
  );
}
