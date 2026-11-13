import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import { CLASSROOM_MODES } from '../../config/constants.js';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import {
  Calendar,
  Clock,
  DollarSign,
  Users,
  Video,
  BookOpen,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Eye,
  Globe
} from 'lucide-react';

export function CreateEditClassModal({ isOpen, onClose, mentor, existingClass, onClassSaved }) {
  const { addToast } = useNotification();
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'schedule' | 'access' | 'preview'
  const [courses, setCourses] = useState([]);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&auto=format&fit=crop&q=80');
  const [category, setCategory] = useState('Conversational Fluency');
  const [learningObjectives, setLearningObjectives] = useState([
    'Speak spontaneously without hesitation',
    'Learn practical native idioms and discourse markers'
  ]);
  const [newObjective, setNewObjective] = useState('');

  // Schedule Fields
  const [classDate, setClassDate] = useState('');
  const [startTime, setStartTime] = useState('19:30');
  const [endTime, setEndTime] = useState('20:15');
  const [calculatedDuration, setCalculatedDuration] = useState(45);

  // Access Fields
  const [isFree, setIsFree] = useState(false);
  const [priceBdt, setPriceBdt] = useState('350');
  const [maxParticipants, setMaxParticipants] = useState(40);
  const [speakingMode, setSpeakingMode] = useState(CLASSROOM_MODES.RAISE_HAND);
  const [maxActiveMics, setMaxActiveMics] = useState(10);
  const [studentJoinWindow, setStudentJoinWindow] = useState(15);
  const [mentorEnterWindow, setMentorEnterWindow] = useState(5);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load mentor's existing courses for association dropdown
  useEffect(() => {
    if (mentor?.id) {
      dbService.getMyCourses(mentor.id).then(list => setCourses(list));
    }
  }, [mentor?.id]);

  // Pre-fill if editing existing class
  useEffect(() => {
    if (existingClass) {
      setTitle(existingClass.title || '');
      setDescription(existingClass.description || '');
      setCourseId(existingClass.course_id || '');
      setThumbnailUrl(existingClass.thumbnail_url || 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&auto=format&fit=crop&q=80');
      setCategory(existingClass.category || 'Conversational Fluency');
      setLearningObjectives(existingClass.learning_objectives?.length ? existingClass.learning_objectives : ['Practice spontaneous speaking']);
      
      if (existingClass.scheduled_at) {
        const d = new Date(existingClass.scheduled_at);
        setClassDate(d.toISOString().split('T')[0]);
        setStartTime(d.toTimeString().substring(0, 5));
        const endD = new Date(d.getTime() + (existingClass.duration_minutes || 45) * 60000);
        setEndTime(endD.toTimeString().substring(0, 5));
      }
      setCalculatedDuration(existingClass.duration_minutes || 45);
      setIsFree(existingClass.is_free ?? (existingClass.price_bdt === 0));
      setPriceBdt(String(existingClass.price_bdt || 0));
      setMaxParticipants(existingClass.max_participants || 40);
      setSpeakingMode(existingClass.speaking_mode || CLASSROOM_MODES.RAISE_HAND);
      setMaxActiveMics(existingClass.max_active_mics || 10);
      setStudentJoinWindow(existingClass.student_join_window_minutes || 15);
      setMentorEnterWindow(existingClass.mentor_enter_window_minutes || 5);
    } else {
      // Defaults for new class (tomorrow 19:30)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setClassDate(tomorrow.toISOString().split('T')[0]);
      setStartTime('19:30');
      setEndTime('20:15');
      setCalculatedDuration(45);
      setIsFree(false);
      setPriceBdt('350');
      setMaxParticipants(40);
    }
  }, [existingClass, isOpen]);

  // Recalculate duration automatically when times change
  useEffect(() => {
    if (startTime && endTime) {
      const [sH, sM] = startTime.split(':').map(Number);
      const [eH, eM] = endTime.split(':').map(Number);
      let diffMins = (eH * 60 + eM) - (sH * 60 + sM);
      if (diffMins < 0) diffMins += 24 * 60; // Crosses midnight
      setCalculatedDuration(Math.max(10, diffMins || 45));
    }
  }, [startTime, endTime]);

  const handleAddObjective = (e) => {
    e.preventDefault();
    if (newObjective.trim()) {
      setLearningObjectives([...learningObjectives, newObjective.trim()]);
      setNewObjective('');
    }
  };

  const handleRemoveObjective = (index) => {
    setLearningObjectives(learningObjectives.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (targetStatus = 'scheduled') => {
    if (!title.trim()) {
      addToast('Class title is required.', 'error');
      setActiveTab('basic');
      return;
    }
    if (!classDate || !startTime) {
      addToast('Please select valid date and start time.', 'error');
      setActiveTab('schedule');
      return;
    }
    if (!isFree && (Number(priceBdt) <= 0 || isNaN(Number(priceBdt)))) {
      addToast('Paid classes must have a valid price in BDT greater than 0.', 'error');
      setActiveTab('access');
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduledIso = new Date(`${classDate}T${startTime}:00`).toISOString();

      const payload = {
        mentor_id: mentor.id,
        mentor_name: mentor.full_name,
        mentor_avatar: mentor.avatar_url,
        title: title.trim(),
        description: description.trim(),
        course_id: courseId || null,
        thumbnail_url: thumbnailUrl,
        category,
        learning_objectives: learningObjectives,
        scheduled_at: scheduledIso,
        duration_minutes: calculatedDuration,
        is_free: isFree,
        price_bdt: isFree ? 0 : Math.round(Number(priceBdt)),
        max_participants: Number(maxParticipants),
        speaking_mode: speakingMode,
        max_active_mics: Number(maxActiveMics),
        student_join_window_minutes: Number(studentJoinWindow),
        mentor_enter_window_minutes: Number(mentorEnterWindow),
        status: targetStatus,
        tags: [category, isFree ? 'Free Class' : 'Premium Workshop'],
      };

      let result;
      if (existingClass?.id) {
        result = await dbService.updateClass(existingClass.id, payload);
        addToast(`Class "${title}" updated successfully!`, 'success');
      } else {
        result = await dbService.createClass(payload);
        addToast(
          targetStatus === 'draft'
            ? `Class saved as draft!`
            : `Class "${title}" successfully published & scheduled!`,
          'success'
        );
      }

      onClassSaved && onClassSaved(result);
      onClose();
    } catch (err) {
      addToast(err.message || 'Failed to save class.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingClass ? 'Edit Live Class' : 'Create & Schedule Live Class'}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        
        {/* Step Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 pb-2 gap-2 text-xs font-semibold overflow-x-auto">
          {[
            { id: 'basic', label: '1. Basic Info' },
            { id: 'schedule', label: '2. Schedule & Duration' },
            { id: 'access', label: '3. Pricing & Modes' },
            { id: 'preview', label: '4. Preview & Publish' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Basic Information */}
        {activeTab === 'basic' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Class Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Master IELTS Speaking Part 2: 2-Minute Monologue Strategy"
                className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Class Description *
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What conversational skills, vocabulary, and live drills will happen in this classroom?"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold"
                >
                  <option value="Conversational Fluency">Conversational Fluency</option>
                  <option value="IELTS Exam Prep">IELTS Exam Prep</option>
                  <option value="Pronunciation">Pronunciation</option>
                  <option value="Workplace English">Workplace English</option>
                  <option value="General Speaking">General Speaking</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Optional Associated Course
                </label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">None (Standalone Live Class)</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Thumbnail Image URL
              </label>
              <input
                type="text"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://..."
                className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            {/* Learning Objectives List */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Learning Objectives
              </label>
              <div className="space-y-1.5 mb-2">
                {learningObjectives.map((obj, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{obj}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveObjective(idx)}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="e.g. Overcome 3-second speaking freeze"
                  className="flex-1 text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAddObjective}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white"
              >
                Next: Schedule & Duration →
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Schedule & Duration */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold">
                <Globe className="w-4 h-4" />
                <span>Timezone Standard: Asia/Dhaka (GMT+6)</span>
              </div>
              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">Strict Server Verification</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Class Date *
              </label>
              <input
                type="date"
                required
                value={classDate}
                onChange={(e) => setClassDate(e.target.value)}
                className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Start Time (Asia/Dhaka) *
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full text-xs font-mono font-bold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  End Time (Asia/Dhaka) *
                </label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full text-xs font-mono font-bold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Calculated Duration Display */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Calculated Duration</span>
                <span className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                  {calculatedDuration} Minutes
                </span>
              </div>
              <Clock className="w-6 h-6 text-indigo-500 opacity-60" />
            </div>

            <div className="pt-2 flex justify-between">
              <button
                type="button"
                onClick={() => setActiveTab('basic')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('access')}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white"
              >
                Next: Pricing & Modes →
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Access Settings & Modes */}
        {activeTab === 'access' && (
          <div className="space-y-4">
            
            {/* Free or Paid Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Class Access Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setIsFree(true); setPriceBdt('0'); }}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    isFree
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="font-extrabold text-xs block">Free Community Class</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    All approved students can enroll for free.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setIsFree(false); if (priceBdt === '0') setPriceBdt('350'); }}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    !isFree
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="font-extrabold text-xs block">Paid Workshop (BDT ৳)</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    Students pay via bKash / SSLCommerz. 80% net mentor share.
                  </span>
                </button>
              </div>
            </div>

            {!isFree && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Class Price in BDT (৳) *
                </label>
                <div className="relative">
                  <span className="text-sm font-bold text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2">৳</span>
                  <input
                    type="number"
                    min={50}
                    max={5000}
                    value={priceBdt}
                    onChange={(e) => setPriceBdt(e.target.value)}
                    placeholder="e.g. 350"
                    className="w-full text-xs font-mono font-bold pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Mentor Net Earnings: ৳{Math.round((Number(priceBdt) || 0) * 0.8)} per enrolled student.
                </span>
              </div>
            )}

            {/* Speaking Mode */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Classroom Speaking Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSpeakingMode(CLASSROOM_MODES.RAISE_HAND)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    speakingMode === CLASSROOM_MODES.RAISE_HAND
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <span className="font-bold text-xs block">✋ Raise Hand Mode</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    Students join muted; mentor approves speaking requests from the queue.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSpeakingMode(CLASSROOM_MODES.OPEN_DISCUSSION)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    speakingMode === CLASSROOM_MODES.OPEN_DISCUSSION
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <span className="font-bold text-xs block">🎙️ Open Discussion</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    Round-table discussion with max simultaneous open microphones.
                  </span>
                </button>
              </div>
            </div>

            {/* Quotas & Capacity */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Max Student Capacity
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
                  Student Join Window (Mins Early)
                </label>
                <input
                  type="number"
                  min={5}
                  max={30}
                  value={studentJoinWindow}
                  onChange={(e) => setStudentJoinWindow(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-between">
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white"
              >
                Next: Preview & Publish →
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Preview & Publish */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            
            {/* Live Class Preview Card */}
            <div className="p-5 rounded-3xl border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-900 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {category}
                </span>
                <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                  {isFree ? 'Free Access' : `৳${Number(priceBdt).toLocaleString()} BDT`}
                </span>
              </div>

              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {title || 'Untitled Class'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {description || 'No description provided.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                <div>
                  <span className="text-slate-400 block">Date</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{classDate || 'TBD'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Time</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{startTime} - {endTime}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Capacity</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{maxParticipants} students</span>
                </div>
              </div>
            </div>

            {/* Submission Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmit('draft')}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Save as Draft
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmit('scheduled')}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all hover:scale-101"
              >
                {isSubmitting ? 'Publishing...' : 'Publish & Schedule Class'}
              </button>
            </div>

          </div>
        )}

      </div>
    </Modal>
  );
}
