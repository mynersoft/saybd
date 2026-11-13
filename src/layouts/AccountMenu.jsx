import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export function AccountMenu({ onNavigateTab }) {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTab = (tabKey) => {
    setIsOpen(false);
    if (onNavigateTab) {
      onNavigateTab(tabKey);
    }
  };

  const role = currentUser?.role || 'student';
  const roleBadgeColors = {
    admin: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
    mentor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800',
    student: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        aria-expanded={isOpen}
      >
        <img
          src={currentUser?.avatar_url?.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.id || 'saybd'}`}
          alt={currentUser?.full_name || 'User avatar'}
          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
        />
        <div className="hidden sm:block text-left">
          <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1 max-w-[120px]">
            {currentUser?.full_name || 'User Profile'}
          </p>
          <span className={`inline-block text-[10px] font-medium uppercase px-1.5 py-0.2 rounded border ${roleBadgeColors[role] || roleBadgeColors.student}`}>
            {role}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* User header info */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Signed in as</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {currentUser?.email || 'user@saybd.com'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-0.5">
              Role: <span className="font-semibold">{role}</span> · Status:{' '}
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {currentUser?.status || 'Active'}
              </span>
            </p>
          </div>

          {/* Account action links */}
          <div className="py-1">
            <button
              onClick={() => handleSelectTab('profile')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>View Profile</span>
            </button>
            <button
              onClick={() => handleSelectTab('edit-profile')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Edit Profile & Avatar</span>
            </button>
            <button
              onClick={() => handleSelectTab('settings')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <span>Account Settings & Security</span>
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                logout(navigate);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left transition-colors font-medium cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
