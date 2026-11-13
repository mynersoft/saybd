import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { Calendar, Clock, AlertTriangle, Users, Send } from 'lucide-react';

export function RescheduleClassModal({ isOpen, onClose, classItem, mentorId, onClassRescheduled }) {
  const { addToast } = useNotification();
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('19:30');
  const [newEndTime, setNewEndTime] = useState('20:15');
  const [calculatedDuration, setCalculatedDuration] = useState(45);
  const [reason, setReason] = useState('Schedule adjusted for timezone and student availability');
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (classItem && isOpen) {
      if (classItem.scheduled_at) {
        const d = new Date(classItem.scheduled_at);
        // set to next day by default for reschedule demo
        d.setDate(d.getDate() + 1);
        setNewDate(d.toISOString().split('T')[0]);
        setNewStartTime(d.toTimeString().substring(0, 5));
        const endD = new Date(d.getTime() + (classItem.duration_minutes || 45) * 60000);
        setNewEndTime(endD.toTimeString().substring(0, 5));
      }
      setCalculatedDuration(classItem.duration_minutes || 45);

      dbService.getClassEnrollments(classItem.id).then(enrs => {
        setEnrolledCount(enrs.length);
      });
    }
  }, [classItem, isOpen]);

  useEffect(() => {
    if (newStartTime && newEndTime) {
      const [sH, sM] = newStartTime.split(':').map(Number);
      const [eH, eM] = newEndTime.split(':').map(Number);
      let diffMins = (eH * 60 + eM) - (sH * 60 + sM);
      if (diffMins < 0) diffMins += 24 * 60;
      setCalculatedDuration(Math.max(10, diffMins || 45));
    }
  }, [newStartTime, newEndTime]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newDate || !newStartTime) {
      addToast('Please select a valid new date and start time.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduledIso = new Date(`${newDate}T${newStartTime}:00`).toISOString();
      const updated = await dbService.rescheduleClass(classItem.id, {
        scheduled_at: scheduledIso,
        duration_minutes: calculatedDuration,
        reason: reason.trim(),
        mentorId
      });

      addToast(`Class rescheduled! ${enrolledCount} enrolled students notified via alert.`, 'success');
      onClassRescheduled && onClassRescheduled(updated);
      onClose();
    } catch (err) {
      addToast(err.message || 'Failed to reschedule class.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!classItem) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reschedule Live Class" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Class Header Information */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Rescheduling Target Class
          </span>
          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
            {classItem.title}
          </h4>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(classItem.scheduled_at).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5" />
              {new Date(classItem.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400">
              <Users className="w-3.5 h-3.5" />
              {enrolledCount} Enrolled Students
            </span>
          </div>
        </div>

        {/* Reschedule Notice Alert */}
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <p className="font-bold">Automatic Student Notification Notice</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              Updating this class will immediately broadcast notifications to all {enrolledCount} enrolled students and update classroom countdown timers.
            </p>
          </div>
        </div>

        {/* New Date and Times */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            New Class Date *
          </label>
          <input
            type="date"
            required
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              New Start Time (Dhaka) *
            </label>
            <input
              type="time"
              required
              value={newStartTime}
              onChange={(e) => setNewStartTime(e.target.value)}
              className="w-full text-xs font-mono font-bold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              New End Time (Dhaka) *
            </label>
            <input
              type="time"
              required
              value={newEndTime}
              onChange={(e) => setNewEndTime(e.target.value)}
              className="w-full text-xs font-mono font-bold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Reason for Rescheduling *
          </label>
          <textarea
            rows={2}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain briefly to students why the time is moving..."
            className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30 flex items-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Rescheduling...' : 'Confirm & Notify Students'}</span>
          </button>
        </div>

      </form>
    </Modal>
  );
}
