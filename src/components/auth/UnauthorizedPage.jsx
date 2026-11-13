import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export function UnauthorizedPage({ requiredRole = 'higher permission', customTitle, customMessage }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const getDashboardPath = () => {
    if (!currentUser) return '/';
    if (currentUser.role === 'admin') return '/dashboard/admin';
    if (currentUser.role === 'mentor') return '/dashboard/mentor';
    return '/dashboard/student';
  };

  return (
    <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
      <div className="w-20 h-20 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center mx-auto shadow-xl shadow-rose-600/10">
        <ShieldAlert className="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
          403 Access Denied
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
          {customTitle || 'Restricted Role Access'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          {customMessage || (
            <>
              You are signed in as <strong>{currentUser?.full_name || 'User'}</strong> with the <strong>{currentUser?.role?.toUpperCase()}</strong> role. This section is strictly restricted to authorized <strong>{requiredRole.toUpperCase()}</strong> accounts.
            </>
          )}
        </p>
      </div>

      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-left">
        <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100 dark:border-slate-800">
          <span className="text-slate-400">Your Current Verified Role:</span>
          <span className="font-bold uppercase px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            {currentUser?.role || 'Guest'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            onClick={() => navigate(getDashboardPath())}
            className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to My Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
