import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import { formatDate } from '../../utils/formatters.js';
import { Users, Search, CheckCircle2, Clock, ShieldCheck, Mail, Calendar } from 'lucide-react';

export function ClassStudentsModal({ isOpen, onClose, classItem }) {
  const [activeTab, setActiveTab] = useState('enrolled'); // 'enrolled' | 'attendance'
  const [enrollments, setEnrollments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (classItem && isOpen) {
      setLoading(true);
      Promise.all([
        dbService.getClassEnrollments(classItem.id),
        dbService.getClassAttendance(classItem.id)
      ]).then(([enrs, atts]) => {
        setEnrollments(enrs);
        setAttendance(atts);
        setLoading(false);
      });
    }
  }, [classItem, isOpen]);

  if (!classItem) return null;

  const filteredEnrollments = enrollments.filter(e =>
    e.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.student_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAttendance = attendance.filter(a =>
    a.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.student_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Students & Attendance — ${classItem.title}`} maxWidth="max-w-2xl">
      <div className="space-y-4">
        
        {/* Navigation Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('enrolled')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'enrolled'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Enrolled Students ({enrollments.length})
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'attendance'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Class Attendance ({attendance.length})
            </button>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students..."
              className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>

        {/* Tab 1: Enrolled Students List */}
        {activeTab === 'enrolled' && (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filteredEnrollments.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">No enrolled students found.</p>
            ) : (
              filteredEnrollments.map((enr) => (
                <div
                  key={enr.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={enr.student_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${enr.student_id}`}
                      alt={enr.student_name}
                      className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                    />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{enr.student_name}</span>
                        {enr.payment_status === 'paid' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Paid ৳{enr.amount_bdt}
                          </span>
                        )}
                        {enr.payment_status === 'free' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            Free
                          </span>
                        )}
                      </p>
                      <span className="text-[11px] text-slate-400 block">{enr.student_email}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> Confirmed
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Enrolled: {formatDate(enr.enrolled_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Attendance Records */}
        {activeTab === 'attendance' && (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filteredAttendance.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">
                No attendance logs recorded yet for this session. Records generate live when students join.
              </p>
            ) : (
              filteredAttendance.map((att) => (
                <div
                  key={att.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={att.student_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${att.student_id}`}
                      alt={att.student_name}
                      className="w-9 h-9 rounded-xl object-cover"
                    />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{att.student_name}</p>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Joined: {new Date(att.actual_join_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {att.actual_leave_time && ` • Left: ${new Date(att.actual_leave_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs block">
                      {Math.round((att.duration_seconds || 0) / 60)} mins active
                    </span>
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                      {att.attendance_status || 'present'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            Close
          </button>
        </div>

      </div>
    </Modal>
  );
}
