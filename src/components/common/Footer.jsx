import React from 'react';
import { Mic, Shield, Globe, Heart } from 'lucide-react';
import { APP_NAME, TAGLINE, DEFAULT_TIMEZONE } from '../../config/constants.js';

export function Footer() {
  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pt-12 pb-24 md:pb-12 text-slate-500 dark:text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Mic className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-base text-slate-900 dark:text-white">
                {APP_NAME}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              {TAGLINE} Connect with vetted community members and certified mentors for real spoken English mastery.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <Shield className="w-3.5 h-3.5" /> Approved Community • Zero Random Abuse
            </div>
          </div>

          <div>
            <h5 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-3">
              Speaking Practice
            </h5>
            <ul className="space-y-2">
              <li>1-on-1 Peer Matching (20m Free Daily)</li>
              <li>Live Mentor Classrooms</li>
              <li>Raise Hand & Open Discussion Modes</li>
              <li>IELTS Speaking Mock Sessions</li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-3">
              Platform & Safety
            </h5>
            <ul className="space-y-2">
              <li>Community Membership Verification</li>
              <li>No Personal Phone/Email Exposure</li>
              <li>In-Call Reporting & User Blocking</li>
              <li>Server-Enforced Daily Allowances</li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-3">
              System Operations
            </h5>
            <p className="leading-relaxed mb-2">
              Daily speaking time resets at 00:00 midnight ({DEFAULT_TIMEZONE} time).
            </p>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-[11px]">
              <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
                <span>Infrastructure:</span>
                <span className="text-indigo-600 dark:text-indigo-400">WebRTC + SFU</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mt-1">
                <span>DB Engine:</span>
                <span>Supabase PostgreSQL</span>
              </div>
            </div>
          </div>

        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Community Guidelines</span>
            <span>•</span>
            <span>Privacy Policy</span>
            <span>•</span>
            <span>Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
