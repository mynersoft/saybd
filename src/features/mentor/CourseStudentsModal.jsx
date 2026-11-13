import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import { formatDate } from '../../utils/formatters.js';
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  BookOpen,
  Award,
  Mail,
  GraduationCap
} from 'lucide-react';

export function CourseStudentsModal({ isOpen, onClose, course }) {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (course && isOpen) {
      setLoading(true);
      dbService.getCourseStudents(course.id).then(list => {
        setStudents(list);
        setLoading(false);
      });
    }
  }, [course, isOpen]);

  if (!course) return null;

  const filtered = students.filter(s =>
    s.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.student_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Enrolled Students — ${course.title}`} maxWidth="max-w-2xl">
      <div className="space-y-4">
        
        {/* Header & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Enrolled</span>
            <p className="text-lg font-black text-slate-900 dark:text-white">
              {students.length} Verified Students
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name..."
              className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>

        {/* Student Cards List */}
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">No enrolled students found.</p>
          ) : (
            filtered.map((student) => (
              <div
                key={student.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={student.student_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.user_id}`}
                      alt={student.student_name}
                      className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                    />
                    <div>
                      <h5 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{student.student_name}</span>
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" /> Verified
                        </span>
                      </h5>
                      <span className="text-[11px] text-slate-400">{student.student_email}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Enrolled: {formatDate(student.enrolled_at)}</span>
                    <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                      {student.progress_percentage}% Completed
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${student.progress_percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400">
                    <span>{student.completed_lessons} of {student.total_lessons} lessons finished</span>
                    <span>Last active: {formatDate(student.last_activity)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

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
