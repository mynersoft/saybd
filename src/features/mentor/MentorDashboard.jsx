import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/supabase/dbService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { formatDate } from '../../utils/formatters.js';
import { CreateEditClassModal } from './CreateEditClassModal.jsx';
import { RescheduleClassModal } from './RescheduleClassModal.jsx';
import { ClassStudentsModal } from './ClassStudentsModal.jsx';
import { CourseBuilderModal } from './CourseBuilderModal.jsx';
import { CourseStudentsModal } from './CourseStudentsModal.jsx';
import { CourseReviewsTab } from './CourseReviewsTab.jsx';
import { MentorEarningsDashboard } from './MentorEarningsDashboard.jsx';
import { MentorDashboardLayout } from './MentorDashboardLayout.jsx';
import { LiveClassroom } from '../classroom/LiveClassroom.jsx';
import { CLASSROOM_MODES } from '../../config/constants.js';
import {
  LayoutDashboard,
  Calendar,
  Radio,
  BookOpen,
  Users,
  DollarSign,
  Star,
  Bell,
  User,
  Plus,
  Play,
  Clock,
  ChevronRight,
  Search,
  Trash2,
  Edit,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Shield,
  Layers,
  ArrowRight,
  Share2
} from 'lucide-react';

export function MentorDashboard({ activeTabProp, onTabChange }) {
  const { currentUser } = useAuth();
  const { addToast } = useNotification();

  // Navigation tab state
  const [internalActiveTab, setInternalActiveTab] = useState('overview'); 
  const activeTab = activeTabProp || internalActiveTab;
  const setActiveTab = onTabChange || setInternalActiveTab;

  // Data states
  const [stats, setStats] = useState(null);
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [classFilter, setClassFilter] = useState('all'); // 'all' | 'upcoming' | 'live' | 'completed' | 'draft' | 'cancelled'
  const [courseFilter, setCourseFilter] = useState('all'); // 'all' | 'published' | 'draft' | 'pending_review' | 'unpublished' | 'archived'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [reschedulingClass, setReschedulingClass] = useState(null);
  const [viewingStudentsClass, setViewingStudentsClass] = useState(null);

  const [isCourseBuilderOpen, setIsCourseBuilderOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [viewingCourseStudents, setViewingCourseStudents] = useState(null);

  // Active Live Classroom Session View
  const [activeClassroom, setActiveClassroom] = useState(null);

  // Load complete mentor data
  const loadDashboardData = async () => {
    if (!currentUser?.id) return;
    try {
      const [overviewStats, myClasses, myCourses, notifs] = await Promise.all([
        dbService.getMentorOverviewStats(currentUser.id),
        dbService.getMyClasses(currentUser.id),
        dbService.getMyCourses(currentUser.id),
        dbService.getUserNotifications(currentUser.id)
      ]);
      setStats(overviewStats);
      setClasses(myClasses);
      setCourses(myCourses);
      setNotifications(notifs);
    } catch (err) {
      console.error('Error loading mentor dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const unsub = dbService.subscribe((msg) => {
      if (['table_update', 'new_notification', 'withdrawal_status_updated'].includes(msg.type)) {
        loadDashboardData();
      }
    });
    return unsub;
  }, [currentUser?.id]);

  // Handle Class Actions
  const handleStartClass = async (cls) => {
    try {
      const updated = await dbService.startLiveClass(cls.id);
      addToast(`Class "${cls.title}" is now LIVE! Enrolled students notified.`, 'success');
      loadDashboardData();
      setActiveClassroom(updated);
    } catch (err) {
      addToast(err.message || 'Failed to start class.', 'error');
    }
  };

  const handleEndClass = async (cls) => {
    if (!confirm(`Are you sure you want to end "${cls.title}"? This will conclude the session and log final student attendance.`)) return;
    try {
      await dbService.endLiveClass(cls.id);
      addToast(`Class ended. Attendance records archived.`, 'success');
      loadDashboardData();
      if (activeClassroom?.id === cls.id) {
        setActiveClassroom(null);
      }
    } catch (err) {
      addToast(err.message || 'Failed to end class.', 'error');
    }
  };

  const handleCancelClass = async (cls) => {
    const reason = prompt('Please enter the cancellation reason to broadcast to enrolled students:');
    if (reason === null) return;
    try {
      await dbService.cancelClass(cls.id, reason, currentUser.id);
      addToast('Class cancelled. Enrolled students notified and payment history preserved.', 'warning');
      loadDashboardData();
    } catch (err) {
      addToast(err.message || 'Failed to cancel class.', 'error');
    }
  };

  const handleDeleteClass = async (cls) => {
    if (!confirm(`Delete class "${cls.title}"? This action is permanent.`)) return;
    try {
      await dbService.deleteClass(cls.id);
      addToast('Class deleted successfully.', 'success');
      loadDashboardData();
    } catch (err) {
      addToast(err.message || 'Cannot delete class.', 'error');
    }
  };

  // Handle Course Actions
  const handlePublishCourse = async (course) => {
    try {
      await dbService.publishCourse(course.id);
      addToast(`Course "${course.title}" published!`, 'success');
      loadDashboardData();
    } catch (err) {
      addToast('Failed to publish course.', 'error');
    }
  };

  const handleUnpublishCourse = async (course) => {
    try {
      await dbService.unpublishCourse(course.id);
      addToast(`Course unpublished from public marketplace.`, 'info');
      loadDashboardData();
    } catch (err) {
      addToast('Failed to unpublish course.', 'error');
    }
  };

  const handleArchiveCourse = async (course) => {
    if (!confirm(`Archive course "${course.title}"? Existing student access will be maintained.`)) return;
    try {
      await dbService.archiveCourse(course.id);
      addToast(`Course archived. Existing purchasers still retain access.`, 'info');
      loadDashboardData();
    } catch (err) {
      addToast('Failed to archive course.', 'error');
    }
  };

  const handleDeleteCourse = async (course) => {
    if (!confirm(`Permanently delete "${course.title}"?`)) return;
    try {
      await dbService.deleteCourse(course.id);
      addToast('Course deleted.', 'success');
      loadDashboardData();
    } catch (err) {
      addToast(err.message || 'Cannot delete course.', 'error');
    }
  };

  // If in active classroom video call view
  if (activeClassroom) {
    return (
      <LiveClassroom
        classroom={activeClassroom}
        currentUser={currentUser}
        onLeaveClass={() => {
          setActiveClassroom(null);
          loadDashboardData();
        }}
      />
    );
  }

  // Filter classes
  const filteredClasses = classes.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;
    if (classFilter === 'all') return true;
    return c.status === classFilter;
  });

  // Filter courses
  const filteredCourses = courses.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;
    if (courseFilter === 'all') return true;
    return (c.approval_status || (c.is_published ? 'published' : 'draft')) === courseFilter;
  });

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'classes', label: 'My Classes', icon: Calendar, badge: classes.filter(c => c.status === 'scheduled').length || null },
    { id: 'classrooms', label: 'My Classrooms', icon: Radio, badge: classes.filter(c => c.status === 'live').length ? 'LIVE' : null },
    { id: 'courses', label: 'My Courses', icon: BookOpen, badge: courses.length || null },
    { id: 'students', label: 'My Students', icon: Users, badge: stats?.totalEnrolledStudents || null },
    { id: 'earnings', label: 'Earnings', icon: DollarSign, badge: stats?.availableEarningsBdt ? `৳${(stats.availableEarningsBdt).toLocaleString()}` : null },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: notifications.filter(n => !n.is_read).length || null },
    { id: 'reviews', label: 'Reviews & Feedback', icon: Star },
    { id: 'profile', label: 'My Profile', icon: User },
  ];

  return (
    <MentorDashboardLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      navItems={navItems}
      currentUser={currentUser}
      stats={stats}
      onNewClass={() => { setEditingClass(null); setIsCreateClassOpen(true); }}
      onNewCourse={() => { setEditingCourse(null); setIsCourseBuilderOpen(true); }}
    >

      {/* ========================================================================= */}
      {/* 1. OVERVIEW TAB */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Top 9 Metrics KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            
            {/* Total Classes */}
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Classes</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{stats?.totalClasses || 0}</p>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <span>{stats?.upcomingClasses || 0} scheduled</span> • <span>{stats?.completedClasses || 0} completed</span>
              </span>
            </div>

            {/* Live Now Classes */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Live Classes</span>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono flex items-center gap-2">
                <span>{stats?.liveClasses || 0}</span>
                {stats?.liveClasses > 0 && <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />}
              </p>
              <span className="text-[11px] text-slate-400">Active interactive video rooms</span>
            </div>

            {/* Total Courses */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Courses Overview</span>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">{stats?.totalCourses || 0}</p>
              <span className="text-[11px] text-slate-500">
                {stats?.publishedCourses || 0} Published • {stats?.draftCourses || 0} Draft
              </span>
            </div>

            {/* Total Enrolled Students */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Enrolled Students</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{stats?.totalEnrolledStudents || 0}</p>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Verified Unique Students</span>
            </div>

            {/* Verified Course Sales */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Verified Gross Sales</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">৳{(stats?.verifiedCourseSalesBdt || 0).toLocaleString()}</p>
              <span className="text-[11px] text-slate-400">Via SSLCommerz Gateway</span>
            </div>

            {/* Available Earnings */}
            <div className="p-5 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-85 block">Available Earnings</span>
              <p className="text-2xl font-black font-mono">৳{(stats?.availableEarningsBdt || 0).toLocaleString()}</p>
              <span className="text-[11px] opacity-90 block">Ready for bKash/Bank payout</span>
            </div>

          </div>

          {/* Quick Actions Bar */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">Quick Teaching Controls</h3>
              <p className="text-xs text-slate-400">Jump directly into your teaching workflow</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={() => { setEditingClass(null); setIsCreateClassOpen(true); }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create New Class
              </button>
              <button
                onClick={() => setActiveTab('classrooms')}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-2"
              >
                <Radio className="w-4 h-4 text-rose-500" /> Enter Classroom
              </button>
              <button
                onClick={() => { setEditingCourse(null); setIsCourseBuilderOpen(true); }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4 text-emerald-500" /> Create New Course
              </button>
            </div>
          </div>

          {/* Upcoming Class Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left: Upcoming Classes */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <span>Scheduled Live Classes</span>
                </h3>
                <button
                  onClick={() => setActiveTab('classes')}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  View All ({classes.length})
                </button>
              </div>

              <div className="space-y-3">
                {classes.slice(0, 3).map(cls => (
                  <div key={cls.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        cls.status === 'live' ? 'bg-rose-500 text-white animate-pulse' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                      }`}>
                        {cls.status}
                      </span>
                      <h4 className="font-extrabold text-slate-900 dark:text-white mt-1">{cls.title}</h4>
                      <span className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3" /> {new Date(cls.scheduled_at).toLocaleDateString()} at {new Date(cls.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <button
                      onClick={() => setActiveClassroom(cls)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 flex items-center gap-1"
                    >
                      <span>Enter</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Published Courses Summary */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  <span>My Learning Courses</span>
                </h3>
                <button
                  onClick={() => setActiveTab('courses')}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Manage Courses ({courses.length})
                </button>
              </div>

              <div className="space-y-3">
                {courses.slice(0, 3).map(c => (
                  <div key={c.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {c.approval_status || (c.is_published ? 'published' : 'draft')}
                      </span>
                      <h4 className="font-extrabold text-slate-900 dark:text-white mt-1">{c.title}</h4>
                      <span className="text-[11px] text-slate-400">
                        ৳{c.price || c.price_bdt} BDT • {c.sections?.reduce((a, s) => a + s.lessons.length, 0) || 0} lessons
                      </span>
                    </div>

                    <button
                      onClick={() => { setEditingCourse(c); setIsCourseBuilderOpen(true); }}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs shrink-0"
                    >
                      Edit Content
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MY CLASSES TAB */}
      {/* ========================================================================= */}
      {activeTab === 'classes' && (
        <div className="space-y-6">
          
          {/* Header & Filter Controls */}
          <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
              {[
                { id: 'all', label: 'All Classes' },
                { id: 'scheduled', label: 'Upcoming' },
                { id: 'live', label: 'Live Now' },
                { id: 'completed', label: 'Completed' },
                { id: 'draft', label: 'Draft' },
                { id: 'cancelled', label: 'Cancelled' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setClassFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                    classFilter === f.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search Input & Action */}
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search classes..."
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <button
                onClick={() => { setEditingClass(null); setIsCreateClassOpen(true); }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Class</span>
              </button>
            </div>

          </div>

          {/* Classes Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClasses.length === 0 ? (
              <div className="col-span-full p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                No classes found matching the selected filter.
              </div>
            ) : (
              filteredClasses.map(cls => {
                const isLive = cls.status === 'live';
                const isCompleted = cls.status === 'completed';
                const isCancelled = cls.status === 'cancelled';
                const isDraft = cls.status === 'draft';

                return (
                  <div
                    key={cls.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Thumbnail & Badges */}
                      <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <img
                          src={cls.thumbnail_url || 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&auto=format&fit=crop&q=80'}
                          alt={cls.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isLive
                              ? 'bg-rose-500 text-white animate-pulse'
                              : isCancelled
                              ? 'bg-rose-900 text-rose-200'
                              : isCompleted
                              ? 'bg-slate-800 text-slate-300'
                              : isDraft
                              ? 'bg-amber-600 text-white'
                              : 'bg-indigo-600 text-white'
                          }`}>
                            {cls.status}
                          </span>

                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-950/70 backdrop-blur-md text-white">
                            {cls.is_free ? 'Free' : `৳${cls.price_bdt || 0}`}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">{cls.category}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {cls.duration_minutes}m
                          </span>
                        </div>

                        <h3 className="font-extrabold text-base text-slate-900 dark:text-white line-clamp-2">
                          {cls.title}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {cls.description}
                        </p>

                        {/* Date and Time (Asia/Dhaka) */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px] space-y-1">
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span className="text-slate-400">Date:</span>
                            <span className="font-bold">{new Date(cls.scheduled_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span className="text-slate-400">Time (Dhaka):</span>
                            <span className="font-mono font-bold">
                              {new Date(cls.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span className="text-slate-400">Capacity:</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {cls.enrolled_count || 0} / {cls.max_participants || 50} enrolled
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Class Action Buttons */}
                    <div className="p-5 pt-0 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {isLive ? (
                          <button
                            onClick={() => handleEndClass(cls)}
                            className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition-all"
                          >
                            End Class
                          </button>
                        ) : !isCompleted && !isCancelled ? (
                          <button
                            onClick={() => handleStartClass(cls)}
                            className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all"
                          >
                            Start Live Now
                          </button>
                        ) : (
                          <button
                            disabled
                            className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold"
                          >
                            {isCompleted ? 'Concluded' : 'Cancelled'}
                          </button>
                        )}

                        <button
                          onClick={() => setActiveClassroom(cls)}
                          className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          <span>Lounge</span>
                        </button>
                      </div>

                      {/* Secondary Management Row */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <button
                          onClick={() => setViewingStudentsClass(cls)}
                          className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <Users className="w-3 h-3" />
                          <span>Students ({cls.enrolled_count || 0})</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingClass(cls); setIsCreateClassOpen(true); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Edit Class Information"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {!isCompleted && !isCancelled && (
                            <button
                              onClick={() => setReschedulingClass(cls)}
                              className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950"
                              title="Reschedule Class & Alert Students"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {!isCompleted && !isCancelled && (
                            <button
                              onClick={() => handleCancelClass(cls)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
                              title="Cancel Class"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteClass(cls)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Delete Class (Draft / Eligible)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MY CLASSROOMS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'classrooms' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
              <span>Live Classroom Sessions & Access Controls</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
              A Classroom is the actual online video and audio meeting room. Students join 15 minutes prior to the scheduled start time, and mentors enter 5 minutes prior to set up their microphone and camera.
            </p>
          </div>

          <div className="space-y-4">
            {classes.map(cls => {
              const access = dbService.getClassroomAccessStatus(cls, currentUser.id, 'mentor');
              const isLive = cls.status === 'live';

              return (
                <div
                  key={cls.id}
                  className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${access.badgeColor}`}>
                        {access.status}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {cls.speaking_mode === CLASSROOM_MODES.RAISE_HAND ? '✋ Raise Hand' : '🎙️ Open Discussion'}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                      {cls.title}
                    </h4>
                    <p className="text-xs text-slate-500">{access.message}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                      <span>Date: <strong>{new Date(cls.scheduled_at).toLocaleDateString()}</strong></span>
                      <span>•</span>
                      <span>Time: <strong>{new Date(cls.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Asia/Dhaka)</strong></span>
                      <span>•</span>
                      <span>Duration: <strong>{cls.duration_minutes}m</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setViewingStudentsClass(cls)}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Attendance ({cls.enrolled_count || 0})
                    </button>

                    <button
                      onClick={() => setActiveClassroom(cls)}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 flex items-center gap-2"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>{isLive ? 'Enter Live Room' : 'Enter Classroom Lounge'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MY COURSES TAB */}
      {/* ========================================================================= */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          
          {/* Header & Filter Bar */}
          <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
              {[
                { id: 'all', label: 'All Courses' },
                { id: 'published', label: 'Published' },
                { id: 'draft', label: 'Draft' },
                { id: 'pending_review', label: 'Pending Review' },
                { id: 'unpublished', label: 'Unpublished' },
                { id: 'archived', label: 'Archived' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setCourseFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                    courseFilter === f.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditingCourse(null); setIsCourseBuilderOpen(true); }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Course</span>
              </button>
            </div>
          </div>

          {/* Courses Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.length === 0 ? (
              <div className="col-span-full p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                No courses found matching the selected filter.
              </div>
            ) : (
              filteredCourses.map(course => {
                const totalLessons = course.sections?.reduce((acc, s) => acc + s.lessons.length, 0) || 0;
                const status = course.approval_status || (course.is_published ? 'published' : 'draft');

                return (
                  <div
                    key={course.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <img
                          src={course.thumbnail_url || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&auto=format&fit=crop&q=80'}
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-950/70 text-white backdrop-blur-md">
                          {status}
                        </div>
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white font-mono">
                          ৳{course.price || course.price_bdt} BDT
                        </div>
                      </div>

                      <div className="p-5 space-y-2">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          {course.category}
                        </span>
                        <h4 className="font-extrabold text-base text-slate-900 dark:text-white line-clamp-2">
                          {course.title}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {course.short_description || course.subtitle}
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                          <span>{totalLessons} Lessons</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {course.total_enrollments || 0} Enrollments
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 pt-0 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { setEditingCourse(course); setIsCourseBuilderOpen(true); }}
                          className="py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                        >
                          Edit Content
                        </button>
                        <button
                          onClick={() => setViewingCourseStudents(course)}
                          className="py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          Students ({course.total_enrollments || 0})
                        </button>
                      </div>

                      {/* Course Publishing Controls */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        {status === 'published' ? (
                          <button
                            onClick={() => handleUnpublishCourse(course)}
                            className="font-bold text-amber-600 hover:underline"
                          >
                            Unpublish
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePublishCourse(course)}
                            className="font-bold text-emerald-600 hover:underline"
                          >
                            Publish Now
                          </button>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleArchiveCourse(course)}
                            className="text-slate-400 hover:text-slate-600"
                            title="Archive Course"
                          >
                            Archive
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(course)}
                            className="text-slate-400 hover:text-rose-500"
                            title="Delete Course (if no sales)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MY STUDENTS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                All Enrolled Students
              </h3>
              <p className="text-xs text-slate-400">
                View student learning activities, enrolled workshops, and course progress tracking.
              </p>
            </div>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
              {stats?.totalEnrolledStudents || 0} Active Learners
            </span>
          </div>

          {/* Quick links to course student management */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {courses.map(course => (
              <div
                key={course.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between"
              >
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{course.title}</h4>
                  <span className="text-xs text-slate-400">{course.total_enrollments || 0} Enrolled Students</span>
                </div>
                <button
                  onClick={() => setViewingCourseStudents(course)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Manage Roster
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. EARNINGS & WITHDRAWALS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'earnings' && (
        <div className="space-y-6">
          <MentorEarningsDashboard />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. REVIEWS & FEEDBACK TAB */}
      {/* ========================================================================= */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <CourseReviewsTab mentorId={currentUser?.id} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. NOTIFICATIONS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Mentor System Alerts & Activity Feed
            </h3>
            <p className="text-xs text-slate-400">
              Live updates for new course sales, student enrollments, schedule modifications, and reviews.
            </p>
          </div>

          <div className="space-y-2.5">
            {notifications.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">No notifications yet.</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white">{n.title}</h5>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {formatDate(n.created_at || n.timestamp)}
                    </span>
                  </div>
                  {n.link && (
                    <a
                      href={n.link}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold shrink-0 text-[11px]"
                    >
                      View
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MY PROFILE TAB */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Mentor Instructor Profile
              </h3>
              <p className="text-xs text-slate-400">
                Manage your credentials, bio, and expertise displayed across all your classrooms.
              </p>
            </div>
            <a
              href="/profile"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white"
            >
              Full Profile Settings
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
              <span className="text-slate-400 uppercase font-bold text-[10px] block">Full Name</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">{currentUser?.full_name}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
              <span className="text-slate-400 uppercase font-bold text-[10px] block">Role</span>
              <span className="font-bold text-indigo-600 uppercase text-sm">{currentUser?.role}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 sm:col-span-2">
              <span className="text-slate-400 uppercase font-bold text-[10px] block">Bio</span>
              <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                {currentUser?.bio || 'Certified English teacher on SayBD.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateEditClassModal
        isOpen={isCreateClassOpen}
        onClose={() => setIsCreateClassOpen(false)}
        mentor={currentUser}
        existingClass={editingClass}
        onClassSaved={() => loadDashboardData()}
      />

      <RescheduleClassModal
        isOpen={Boolean(reschedulingClass)}
        onClose={() => setReschedulingClass(null)}
        classItem={reschedulingClass}
        mentorId={currentUser?.id}
        onClassRescheduled={() => loadDashboardData()}
      />

      <ClassStudentsModal
        isOpen={Boolean(viewingStudentsClass)}
        onClose={() => setViewingStudentsClass(null)}
        classItem={viewingStudentsClass}
      />

      <CourseBuilderModal
        isOpen={isCourseBuilderOpen}
        onClose={() => setIsCourseBuilderOpen(false)}
        currentUser={currentUser}
        existingCourse={editingCourse}
        onCourseSaved={() => loadDashboardData()}
      />

      <CourseStudentsModal
        isOpen={Boolean(viewingCourseStudents)}
        onClose={() => setViewingCourseStudents(null)}
        course={viewingCourseStudents}
      />

    </MentorDashboardLayout>
  );
}
