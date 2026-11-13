import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Video,
  ExternalLink,
  ChevronRight,
  User,
  Users,
  CheckCircle,
  Play
} from 'lucide-react';
import { dbService } from '../../services/supabase/dbService.js';

export function StudentClassesView({ initialFilter = 'upcoming' }) {
  const [filter, setFilter] = useState(initialFilter); // 'upcoming' | 'completed' | 'all'
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await dbService.getClasses();
        setClasses(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = classes.filter((c) => {
    if (filter === 'upcoming') return c.status === 'scheduled' || c.status === 'live';
    if (filter === 'completed') return c.status === 'completed';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            My Enrolled Live Classes
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track your scheduled mentor sessions, join live rooms, and review past class notes.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'upcoming'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'completed'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Classes
          </button>
        </div>
      </div>

      {/* Class List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length > 0 ? (
          filtered.map((cls) => (
            <div
              key={cls.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    {cls.category || 'Spoken English'}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      cls.status === 'live'
                        ? 'bg-rose-500 text-white animate-pulse'
                        : cls.status === 'completed'
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {cls.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3">
                  {cls.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                  {cls.description || 'Interactive speaking practice session with live mentor guidance.'}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cls.schedule_date || 'Today'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cls.start_time || '8:00 PM'} - {cls.end_time || '9:00 PM'} (Dhaka Time)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cls.enrolled_count || 0} students enrolled</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  {cls.is_paid ? `৳${cls.price_bdt}` : 'Free Class'}
                </span>
                <button
                  onClick={() => alert(`Entering class room: ${cls.title}`)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    cls.status === 'live'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>{cls.status === 'live' ? 'Join Live Room' : 'View Room'}</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-sm text-slate-400">
            No classes found for this filter.
          </div>
        )}
      </div>
    </div>
  );
}
