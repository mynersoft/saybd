import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import { CLASSROOM_MODES } from '../../config/constants.js';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { Radio, Users, Sparkles } from 'lucide-react';

export function CreateClassModal({ isOpen, onClose, mentor, onClassCreated }) {
  const { addToast } = useNotification();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [speakingMode, setSpeakingMode] = useState(CLASSROOM_MODES.RAISE_HAND);
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [maxActiveMics, setMaxActiveMics] = useState(10);
  const [startImmediately, setStartImmediately] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const newClass = await dbService.createClass({
        mentor_id: mentor.id,
        mentor_name: mentor.full_name,
        mentor_avatar: mentor.avatar_url,
        title,
        description,
        speaking_mode: speakingMode,
        max_participants: Number(maxParticipants),
        max_active_mics: Number(maxActiveMics),
        status: startImmediately ? 'live' : 'scheduled',
        scheduled_at: new Date().toISOString(),
        duration_minutes: 45,
        tags: ['Speaking', 'Mentor Live'],
      });

      addToast(`Class "${title}" created successfully!`, 'success');
      onClassCreated && onClassCreated(newClass);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Live Mentor Classroom" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Class Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Master IELTS Speaking Part 2 & 3 Strategies"
            className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Topic & Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will students learn and practice in this session?"
            className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Speaking Mode Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Classroom Speaking Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                speakingMode === CLASSROOM_MODES.RAISE_HAND
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={CLASSROOM_MODES.RAISE_HAND}
                checked={speakingMode === CLASSROOM_MODES.RAISE_HAND}
                onChange={() => setSpeakingMode(CLASSROOM_MODES.RAISE_HAND)}
                className="sr-only"
              />
              <div className="font-bold text-xs flex items-center gap-1.5">
                <span>✋ Mode A: Raise Hand Mode</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Students request permission to speak. Mentor approves students one by one from the queue.
              </p>
            </label>

            <label
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                speakingMode === CLASSROOM_MODES.OPEN_DISCUSSION
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={CLASSROOM_MODES.OPEN_DISCUSSION}
                checked={speakingMode === CLASSROOM_MODES.OPEN_DISCUSSION}
                onChange={() => setSpeakingMode(CLASSROOM_MODES.OPEN_DISCUSSION)}
                className="sr-only"
              />
              <div className="font-bold text-xs flex items-center gap-1.5">
                <span>🎙️ Mode B: Open Discussion</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Active student microphones allowed up to configured limit. Ideal for round-table banter.
              </p>
            </label>
          </div>
        </div>

        {/* Quotas & Capacity */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Max Students (MVP Target)
            </label>
            <input
              type="number"
              min={5}
              max={200}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Max Active Mics (Open Mode)
            </label>
            <input
              type="number"
              min={2}
              max={20}
              value={maxActiveMics}
              onChange={(e) => setMaxActiveMics(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
          >
            {isSubmitting ? 'Launching...' : 'Start Live Class Now'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
