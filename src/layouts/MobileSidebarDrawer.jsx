import React from 'react';
import {
  X,
  GraduationCap,
  Sparkles
} from 'lucide-react';

export function MobileSidebarDrawer({
  isOpen = false,
  onClose,
  navigationGroups = [],
  activeTab = '',
  onSelectTab,
  role = 'student'
}) {
  if (!isOpen) return null;

  const handleItemClick = (key) => {
    onSelectTab(key);
    onClose();
  };

  const roleColors = {
    student: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    mentor: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
    admin: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-250">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                Say<span className="text-indigo-600 dark:text-indigo-400">BD</span>
              </span>
              <span className={`block text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded border w-max ${roleColors[role] || roleColors.student}`}>
                {role} Panel
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navigationGroups.map((group, gIdx) => (
            <div key={group.group || gIdx} className="space-y-1">
              {group.group && (
                <p className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {group.group}
                </p>
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const itemKey = item.id || item.key;
                const isItemActive = activeTab === itemKey || activeTab.startsWith(itemKey.replace(/^[a-z]+-/, ''));

                return (
                  <button
                    key={itemKey}
                    onClick={() => handleItemClick(itemKey)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isItemActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {Icon && <Icon className={`w-4 h-4 shrink-0 ${isItemActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />}
                      <span className="truncate">{item.label || item.title}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 font-bold shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                  Dhaka Timezone
                </p>
                <p className="text-[10px] text-slate-400">Asia/Dhaka (GMT+6)</p>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
