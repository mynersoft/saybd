import React, { useState, useEffect } from 'react';
import {
  Clock,
  User,
  Calendar,
  Sparkles,
  PhoneCall,
  Volume2,
  FileText
} from 'lucide-react';
import { dbService } from '../../services/supabase/dbService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

export function PracticeHistoryView() {
  const { currentUser } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await dbService.getPracticeHistory(currentUser?.id);
        setHistory(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentUser?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          1-on-1 Practice History & Logs
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Review your peer speaking sessions, recorded call duration, AI vocabulary hints, and practice topics.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Partner</th>
                <th className="px-4 py-3.5">Topic</th>
                <th className="px-4 py-3.5">Duration</th>
                <th className="px-4 py-3.5">Date & Time</th>
                <th className="px-4 py-3.5">Vocabulary / Feedback</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.length > 0 ? (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-bold flex items-center justify-center">
                          {item.partner_name?.charAt(0) || 'P'}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {item.partner_name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Level: {item.partner_level || 'Intermediate'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-200">
                      {item.topic}
                    </td>

                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3" />
                        {item.duration_minutes} mins
                      </span>
                    </td>

                    <td className="px-4 py-4 text-slate-500">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(item.vocab_learned || []).map((v, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => alert(`Session feedback note: Great flow on ${item.topic}`)}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        View Notes
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">
                    No practice sessions recorded yet. Start practicing today!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
