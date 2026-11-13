import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Radio,
  BookOpen,
  Users,
  DollarSign,
  Bell,
  Star,
  User,
  Plus,
  Clock,
  Menu,
  X,
  ChevronRight,
  Shield,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export function MentorDashboardLayout({
  activeTab,
  setActiveTab,
  navItems = [],
  currentUser,
  stats,
  onNewClass,
  onNewCourse,
  children
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Default nav items if not explicitly provided
  const items = navItems.length > 0 ? navItems : [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'classes', label: 'My Classes', icon: Calendar, badge: stats?.upcomingClasses || null },
    { id: 'classrooms', label: 'My Classrooms', icon: Radio, badge: stats?.liveClasses > 0 ? 'LIVE' : null },
    { id: 'courses', label: 'My Courses', icon: BookOpen, badge: stats?.totalCourses || null },
    { id: 'students', label: 'My Students', icon: Users, badge: stats?.totalEnrolledStudents || null },
    { id: 'earnings', label: 'Earnings', icon: DollarSign, badge: stats?.availableEarningsBdt ? `৳${(stats.availableEarningsBdt).toLocaleString()}` : null },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: stats?.unreadNotifications || null },
    { id: 'reviews', label: 'Reviews & Feedback', icon: Star },
    { id: 'profile', label: 'My Profile', icon: User },
  ];

  const currentItem = items.find(i => i.id === activeTab) || items[0];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col lg:flex-row min-h-[600px] lg:min-h-[820px] transition-colors relative">
      
      {/* ========================================================================= */}
      {/* 1. DESKTOP PERMANENT SIDEBAR */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-5 shrink-0 justify-between">
        <div className="space-y-6">
          
          {/* Mentor Profile / Brand Header */}
          <div className="flex items-center gap-3 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
              <img
                src={currentUser?.avatar_url?.trim() || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200'}
                alt={currentUser?.full_name || 'Mentor'}
                className="w-11 h-11 rounded-2xl object-cover ring-2 ring-indigo-500/30"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                {currentUser?.full_name || 'Mentor Studio'}
              </h3>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold truncate flex items-center gap-1">
                <Shield className="w-3 h-3 shrink-0" />
                <span>Certified Instructor</span>
              </p>
            </div>
          </div>

          {/* Primary Navigation Links */}
          <nav className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pb-2 block">
              Teaching & Management
            </span>

            {items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'
                    }`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        item.badge === 'LIVE'
                          ? 'bg-rose-500 text-white animate-pulse'
                          : isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Timezone & Quick Actions */}
        <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="px-3 py-2 rounded-xl bg-slate-200/50 dark:bg-slate-900/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span>Asia/Dhaka</span>
            </span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">GMT+6</span>
          </div>

          <div className="space-y-1.5">
            {onNewClass && (
              <button
                onClick={onNewClass}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 hover:scale-101"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Class</span>
              </button>
            )}

            {onNewCourse && (
              <button
                onClick={onNewCourse}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 hover:scale-101"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Create New Course</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE RESPONSIVE HEADER BAR (< lg) */}
      {/* ========================================================================= */}
      <div className="lg:hidden p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between gap-3 sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-xs"
            aria-label="Toggle Sidebar Navigation"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div>
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>{currentItem.label}</span>
            </h2>
            <span className="text-[10px] text-slate-400">Mentor Studio</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNewClass && (
            <button
              onClick={onNewClass}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Class</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MOBILE SLIDE-OUT DRAWER */}
      {/* ========================================================================= */}
      {isMobileMenuOpen && (
        <>
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden"
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 z-50 p-5 shadow-2xl flex flex-col justify-between overflow-y-auto lg:hidden animate-in slide-in-from-left duration-200">
            <div className="space-y-5">
              
              {/* Drawer Top Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <img
                    src={currentUser?.avatar_url?.trim() || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200'}
                    alt={currentUser?.full_name || 'Mentor'}
                    className="w-9 h-9 rounded-xl object-cover ring-2 ring-indigo-500/20"
                  />
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{currentUser?.full_name}</h4>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Mentor Studio</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation List */}
              <nav className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== null && item.badge !== undefined && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.badge === 'LIVE'
                            ? 'bg-rose-500 text-white animate-pulse'
                            : isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              {onNewClass && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onNewClass();
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Class</span>
                </button>
              )}
              {onNewCourse && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onNewCourse();
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Create New Course</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 4. MAIN CONTENT VIEWPORT */}
      {/* ========================================================================= */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
        
        {/* Top Contextual Header (Desktop breadcrumbs & actions) */}
        <div className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60 backdrop-blur-xs">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-400">Mentor Studio</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
            <span className="font-extrabold text-slate-900 dark:text-white text-sm">
              {currentItem.label}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Available balance highlight */}
            {stats?.availableEarningsBdt !== undefined && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold font-mono">
                <span>৳{(stats.availableEarningsBdt || 0).toLocaleString()}</span>
                <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400">available</span>
              </div>
            )}

            {onNewClass && (
              <button
                onClick={onNewClass}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs hover:scale-102 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Class</span>
              </button>
            )}

            {onNewCourse && (
              <button
                onClick={onNewCourse}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs hover:scale-102 transition-all flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>New Course</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content Viewport */}
        <div className="flex-1 p-3.5 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
          {children}
        </div>

      </div>

    </div>
  );
}
