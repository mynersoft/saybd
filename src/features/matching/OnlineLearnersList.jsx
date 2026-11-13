import React, { useState } from 'react';
import { Users, PhoneCall, RefreshCw, Sparkles, Search, MessageSquare, ShieldCheck, Check } from 'lucide-react';
import { formatActiveMoment } from '../../utils/formatters.js';


export function OnlineLearnersList({
  learners = [],
  currentUserId = null,
  onPracticeWithUser,
  isLoading = false,
  onRefresh
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshClick = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };



  // Filter out current user from candidates to call, but keep track of self
  const otherLearners = learners.filter(l => l.id !== currentUserId);
  const selfUser = learners.find(l => l.id === currentUserId);

  const filteredLearners = otherLearners.filter(l => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      l.full_name?.toLowerCase().includes(query) ||
      l.native_language?.toLowerCase().includes(query) ||
      l.country?.toLowerCase().includes(query) ||
      l.bio?.toLowerCase().includes(query)
    );
  });


  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Who's Online Now
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              {otherLearners.length} active
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real learners active in the community. Tap <strong>Practice</strong> to connect directly or use matchmaking above.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or language..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-44 sm:w-56 transition-all"
            />
          </div>

          <button
            onClick={handleRefreshClick}
            disabled={isRefreshing || isLoading}
            className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
            title="Refresh active list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Current User Active Indicator Banner */}
      {selfUser && (
        <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              Your Status: <strong className="text-slate-900 dark:text-white font-semibold">Active & Visible</strong>
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Partners can discover and connect with you
          </span>
        </div>
      )}

      {/* Learners Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 animate-pulse flex items-center gap-3.5"
            >
              <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
              <div className="space-y-2 flex-1">
                <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredLearners.length === 0 ? (
        <div className="text-center py-8 px-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700">
          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {searchQuery ? 'No members found matching your search' : 'No users online right now.'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {searchQuery ? 'Try another search term or clear the filter.' : 'Share your practice invite link with a friend to start speaking, or check back soon!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredLearners.map((learner) => {
            const activeText = formatActiveMoment(learner.last_heartbeat, learner.in_call);
            const isFresh = activeText === 'Active now' || activeText.includes('1m');

            return (
              <div
                key={learner.id}
                className="group p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 hover:bg-white dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-slate-200/80 hover:border-indigo-200 dark:border-slate-800 dark:hover:border-indigo-800/60 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar with status indicator */}
                  <div className="relative shrink-0">
                    {learner.avatar_url ? (
                      <img
                        src={learner.avatar_url}
                        alt={learner.full_name}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-700"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextElementSibling) {
                            e.currentTarget.nextElementSibling.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm flex items-center justify-center ring-2 ring-slate-100 dark:ring-slate-700 uppercase"
                      style={{ display: learner.avatar_url ? 'none' : 'flex' }}
                    >
                      {(learner.full_name || 'U').charAt(0)}
                    </div>

                    {/* Active Sign Dot on Avatar */}
                    {learner.in_call ? (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900 shadow-xs"
                        title="In a Call"
                      />
                    ) : (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-xs flex items-center justify-center"
                        title={activeText}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      </span>
                    )}
                  </div>

                  {/* Name and Meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {learner.full_name}
                      </h4>
                      {learner.role === 'mentor' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          Coach
                        </span>
                      )}
                    </div>

                    {/* Active sign text badge */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {learner.in_call ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          In a call
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            isFresh
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isFresh ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-400'
                            }`}
                          ></span>
                          {activeText}
                        </span>
                      )}

                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {learner.native_language || 'Bengali'}
                      </span>
                    </div>

                    {/* Bio or practicing target */}
                    {learner.bio && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                        {learner.bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Practice Button */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-400">
                    {learner.country || 'Bangladesh'}
                  </span>

                  {learner.in_call ? (
                    <button
                      disabled
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-semibold cursor-not-allowed"
                    >
                      In Call
                    </button>
                  ) : (
                    <button
                      onClick={() => onPracticeWithUser && onPracticeWithUser(learner)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-600 hover:text-white dark:text-indigo-300 dark:hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-sm hover:scale-102 active:scale-95"
                    >
                      <PhoneCall className="w-3 h-3" />
                      <span>Practice</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer hint */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
        <span>Instant connection • Peer-to-peer audio & video</span>
        <span>Auto-refreshes every 30 seconds</span>
      </div>
    </div>
  );
}
