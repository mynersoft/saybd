import React from 'react';
import { Menu, Sun, Moon, ArrowLeft } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { AccountMenu } from './AccountMenu.jsx';
import { NotificationMenu } from './NotificationMenu.jsx';

export function DashboardTopbar({
  title = 'Dashboard',
  subtitle = '',
  breadcrumbs = [],
  onOpenMobileMenu,
  onNavigateTab,
  role = 'student',
  extraAction = null
}) {
  const { darkMode, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6">
      {/* Left side: Hamburger button + Title / Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <span>Dashboard</span>
              <span>/</span>
              <span className="capitalize">{role}</span>
              {breadcrumbs.map((b, i) => (
                <React.Fragment key={i}>
                  <span>/</span>
                  <span className="text-slate-600 dark:text-slate-300 capitalize">{b}</span>
                </React.Fragment>
              ))}
            </div>
          )}
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden md:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right side: Action slot, theme toggle, notifications, account menu */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {extraAction}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Notifications */}
        <NotificationMenu onNavigateTab={onNavigateTab} />

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* User Account Menu */}
        <AccountMenu onNavigateTab={onNavigateTab} />
      </div>
    </header>
  );
}
