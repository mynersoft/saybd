import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { AlertTriangle, Mail, LogOut } from 'lucide-react';

export function SuspendedAccountPage({ status = 'suspended', reason }) {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  return (
    <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
      <div className="w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center mx-auto shadow-xl shadow-amber-600/10">
        <AlertTriangle className="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          Account {status.toUpperCase()}
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
          Account Access Temporarily Restricted
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          The account for <strong>{currentUser?.full_name}</strong> ({currentUser?.email}) has been marked as <strong>{status}</strong> in our platform safety records.
        </p>
      </div>

      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-left">
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <span className="font-bold block">Notice from Administration:</span>
          <p className="leading-relaxed">
            {reason || currentUser?.approval_notes || 'Your account is under community safety review. In order to protect community members, access to live speaking calls and classrooms is restricted.'}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <a
            href="mailto:support@saybd.com"
            className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
          >
            <Mail className="w-4 h-4" />
            <span>Contact Support / Appeal</span>
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={() => logout(navigate)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
