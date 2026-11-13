import React from 'react';
import { Mic, Loader2 } from 'lucide-react';

export function LoadingScreen({ message = 'Verifying security credentials...' }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-indigo-600/10 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 relative shadow-lg shadow-indigo-500/10">
        <Mic className="w-7 h-7" />
        <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-xs">
          <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
        </span>
      </div>
      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
        Speak<span className="text-indigo-600 dark:text-indigo-400">Mate</span>
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        {message}
      </p>
    </div>
  );
}
