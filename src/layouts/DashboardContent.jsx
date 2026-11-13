import React from 'react';

export function DashboardContent({ children, maxWidth = 'max-w-7xl' }) {
  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950/60 p-3 sm:p-6 lg:p-8">
      <div className={`${maxWidth} mx-auto w-full transition-all`}>
        {children}
      </div>
    </main>
  );
}
