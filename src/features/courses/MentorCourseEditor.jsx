import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { Plus, Trash2, Video, BookOpen, Sparkles } from 'lucide-react';

export function MentorCourseEditor({ isOpen, onClose, currentUser, onSave }) {
  const { addToast } = useNotification();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('Conversational Fluency');
  const [level, setLevel] = useState('Intermediate');
  const [priceBdt, setPriceBdt] = useState('1200');
  const [thumbnailUrl, setThumbnailUrl] = useState('https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&auto=format&fit=crop&q=80');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [sections, setSections] = useState([
    {
      id: 'sec_1',
      title: 'Module 1: Getting Started',
      lessons: [
        {
          id: 'les_1',
          title: 'Lesson 1: Introduction',
          duration: '10 min',
          is_preview: true,
          video_url: '',
          resources: []
        }
      ]
    }
  ]);

  const handleAddSection = () => {
    const newSec = {
      id: `sec_${Date.now()}`,
      title: `Module ${sections.length + 1}: Practical Exercises`,
      lessons: [
        {
          id: `les_${Date.now()}`,
          title: 'New Video Lesson',
          duration: '10 min',
          is_preview: false,
          video_url: '',
          resources: []
        }
      ]
    };
    setSections([...sections, newSec]);
  };

  const handleAddLesson = (secIdx) => {
    const updated = [...sections];
    updated[secIdx].lessons.push({
      id: `les_${Date.now()}`,
      title: 'New Practice Lesson',
      duration: '10 min',
      is_preview: false,
      video_url: '',
      resources: []
    });
    setSections(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await dbService.saveCourse({
        mentor_id: currentUser.id,
        mentor_name: currentUser.full_name,
        title,
        subtitle,
        category,
        level,
        price_cents: Math.max(0, parseInt(priceBdt, 10) * 100),
        currency: 'BDT',
        thumbnail_url: thumbnailUrl,
        sections,
        is_published: true,
      });

      addToast(`Course "${title}" created and published!`, 'success');
      onSave && onSave();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create English Course" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Course Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Master Spoken English Idioms & Pronunciation"
            className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Subtitle / Short Description
          </label>
          <textarea
            rows={2}
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="What will students accomplish after finishing this course?"
            className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            >
              <option value="Conversational Fluency">Conversational Fluency</option>
              <option value="IELTS Exam Prep">IELTS Exam Prep</option>
              <option value="Pronunciation">Pronunciation</option>
              <option value="Workplace English">Workplace English</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Level
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            >
              <option value="All Levels">All Levels</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Price (BDT ৳)
            </label>
            <input
              type="number"
              min={0}
              value={priceBdt}
              onChange={(e) => setPriceBdt(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </div>
        </div>

        {/* Curriculum Sections Editor */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Curriculum Sections & Video Lessons
            </span>
            <button
              type="button"
              onClick={handleAddSection}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Section
            </button>
          </div>

          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {sections.map((sec, secIdx) => (
              <div key={sec.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
                <input
                  type="text"
                  value={sec.title}
                  onChange={(e) => {
                    const updated = [...sections];
                    updated[secIdx].title = e.target.value;
                    setSections(updated);
                  }}
                  className="w-full font-bold p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 mb-2"
                />

                <div className="pl-3 space-y-1.5 border-l-2 border-indigo-400">
                  {sec.lessons.map((les, lesIdx) => (
                    <div key={les.id} className="flex items-center gap-2">
                      <Video className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <input
                        type="text"
                        value={les.title}
                        onChange={(e) => {
                          const updated = [...sections];
                          updated[secIdx].lessons[lesIdx].title = e.target.value;
                          setSections(updated);
                        }}
                        className="flex-1 p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                      <span className="text-[10px] text-slate-400 shrink-0">{les.duration}</span>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAddLesson(secIdx)}
                    className="text-[11px] text-indigo-500 hover:underline pt-1 block"
                  >
                    + Add Lesson
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
          >
            {isSubmitting ? 'Publishing...' : 'Publish Course'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
