import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import {
  BookOpen,
  Plus,
  Trash2,
  Video,
  FileText,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  Lock,
  Unlock,
  Eye,
  FileCheck,
  Send,
  Layers
} from 'lucide-react';

export function CourseBuilderModal({ isOpen, onClose, currentUser, existingCourse, onCourseSaved }) {
  const { addToast } = useNotification();
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'curriculum' | 'pricing' | 'preview'

  // Basic Information
  const [title, setTitle] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&auto=format&fit=crop&q=80');
  const [category, setCategory] = useState('Conversational Fluency');
  const [difficultyLevel, setDifficultyLevel] = useState('Intermediate');
  const [courseLanguage, setCourseLanguage] = useState('English (US)');

  // Objectives and Requirements
  const [learningObjectives, setLearningObjectives] = useState([
    'Overcome speaking hesitation and speak with native rhythm',
    'Learn high-frequency workplace idioms'
  ]);
  const [newObjective, setNewObjective] = useState('');

  const [whatYouWillLearn, setWhatYouWillLearn] = useState([
    'How to think directly in English without native language translation',
    'Cadence and intonation markers'
  ]);
  const [newLearnItem, setNewLearnItem] = useState('');

  const [requirements, setRequirements] = useState([
    'Basic knowledge of simple English sentences'
  ]);
  const [newReq, setNewReq] = useState('');

  // Pricing
  const [isFree, setIsFree] = useState(false);
  const [priceBdt, setPriceBdt] = useState('1200');
  const [discountPriceBdt, setDiscountPriceBdt] = useState('990');

  const [uploadingLesson, setUploadingLesson] = useState(null);

  // Curriculum: Course -> Sections -> Lessons
  const [sections, setSections] = useState([
    {
      id: 'sec_1',
      title: 'Module 1: Getting Started',
      lessons: [
        {
          id: 'les_1',
          title: 'Lesson 1: Introduction',
          description: '',
          duration: '10 min',
          duration_minutes: 10,
          is_preview: true,
          video_url: '',
          content_text: '',
          pdf_resources: [],
          downloadable_files: []
        }
      ]
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (existingCourse && isOpen) {
      setTitle(existingCourse.title || '');
      setShortDesc(existingCourse.short_description || existingCourse.subtitle || '');
      setDescription(existingCourse.description || '');
      setThumbnailUrl(existingCourse.thumbnail_url || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&auto=format&fit=crop&q=80');
      setCategory(existingCourse.category || 'Conversational Fluency');
      setDifficultyLevel(existingCourse.difficulty_level || existingCourse.level || 'Intermediate');
      setCourseLanguage(existingCourse.course_language || 'English (US)');
      setLearningObjectives(existingCourse.learning_objectives?.length ? existingCourse.learning_objectives : ['Practice spontaneous speaking']);
      setWhatYouWillLearn(existingCourse.what_you_will_learn?.length ? existingCourse.what_you_will_learn : ['Master sentence transitions']);
      setRequirements(existingCourse.student_requirements?.length ? existingCourse.student_requirements : ['Basic English vocabulary']);
      
      const p = existingCourse.price_bdt ?? (existingCourse.price_cents ? existingCourse.price_cents / 100 : (existingCourse.price || 0));
      setPriceBdt(String(p));
      setIsFree(p === 0);
      setDiscountPriceBdt(String(existingCourse.discount_price_bdt || ''));

      if (existingCourse.sections && Array.isArray(existingCourse.sections) && existingCourse.sections.length > 0) {
        setSections(existingCourse.sections);
      }
    } else if (!existingCourse && isOpen) {
      setTitle('');
      setShortDesc('');
      setDescription('');
      setPriceBdt('1200');
      setDiscountPriceBdt('990');
      setIsFree(false);
    }
  }, [existingCourse, isOpen]);

  // Section manipulation
  const handleAddSection = () => {
    const newSec = {
      id: `sec_${Date.now()}`,
      title: `Module ${sections.length + 1}`,
      lessons: [
        {
          id: `les_${Date.now()}`,
          title: 'Lesson 1',
          description: '',
          duration: '10 min',
          duration_minutes: 10,
          is_preview: false,
          video_url: '',
          content_text: '',
          pdf_resources: [],
          downloadable_files: []
        }
      ]
    };
    setSections([...sections, newSec]);
  };

  const handleRemoveSection = (secIdx) => {
    if (sections.length <= 1) {
      addToast('A course must have at least one curriculum module.', 'warning');
      return;
    }
    setSections(sections.filter((_, idx) => idx !== secIdx));
  };

  const handleMoveSection = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const updated = [...sections];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setSections(updated);
  };

  // Lesson manipulation
  const handleAddLesson = (secIdx) => {
    const updated = [...sections];
    const currentLessons = updated[secIdx].lessons || [];
    currentLessons.push({
      id: `les_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: `Lesson ${currentLessons.length + 1}`,
      description: '',
      duration: '10 min',
      duration_minutes: 10,
      is_preview: false,
      video_url: '',
      content_text: '',
      pdf_resources: [],
      downloadable_files: []
    });
    updated[secIdx].lessons = currentLessons;
    setSections(updated);
  };

  const handleRemoveLesson = (secIdx, lesIdx) => {
    const updated = [...sections];
    if (updated[secIdx].lessons.length <= 1) {
      addToast('Each section must have at least one lesson.', 'warning');
      return;
    }
    updated[secIdx].lessons = updated[secIdx].lessons.filter((_, idx) => idx !== lesIdx);
    setSections(updated);
  };

  const handleUpdateLesson = (secIdx, lesIdx, field, value) => {
    const updated = [...sections];
    updated[secIdx].lessons[lesIdx] = {
      ...updated[secIdx].lessons[lesIdx],
      [field]: value
    };
    setSections(updated);
  };

  const handlePdfUpload = async (secIdx, lesIdx, fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadingLesson(`${secIdx}-${lesIdx}`);
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await dbService.uploadLessonPdf(currentUser.id, file));
      }
      setSections((prev) =>
        prev.map((sec, si) =>
          si !== secIdx
            ? sec
            : {
                ...sec,
                lessons: sec.lessons.map((les, li) =>
                  li !== lesIdx
                    ? les
                    : {
                        ...les,
                        pdf_resources: [
                          ...(Array.isArray(les.pdf_resources) ? les.pdf_resources : []),
                          ...uploaded,
                        ],
                      }
                ),
              }
        )
      );
      addToast(`${uploaded.length} PDF uploaded`, 'success');
    } catch (err) {
      addToast(err.message || 'PDF upload failed', 'error');
    } finally {
      setUploadingLesson(null);
    }
  };

  const handleRemovePdf = (secIdx, lesIdx, pdfIdx) => {
    const list = sections[secIdx].lessons[lesIdx].pdf_resources;
    const arr = Array.isArray(list) ? list : [];
    handleUpdateLesson(secIdx, lesIdx, 'pdf_resources', arr.filter((_, i) => i !== pdfIdx));
  };

  const handleSaveCourse = async (approvalStatus = 'published') => {
    if (!title.trim()) {
      addToast('Please enter a course title.', 'error');
      setActiveTab('basic');
      return;
    }

    const priceNum = isFree ? 0 : Number(priceBdt);
    if (!isFree && (isNaN(priceNum) || priceNum <= 0)) {
      addToast('Please specify a valid course price in BDT greater than 0.', 'error');
      setActiveTab('pricing');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id: existingCourse?.id || `course_${Date.now()}`,
        mentor_id: currentUser.id,
        mentor_name: currentUser.full_name,
        title: title.trim(),
        subtitle: shortDesc.trim() || title.trim(),
        short_description: shortDesc.trim(),
        description: description.trim(),
        category,
        level: difficultyLevel,
        difficulty_level: difficultyLevel,
        course_language: courseLanguage,
        price: priceNum,
        price_bdt: priceNum,
        price_cents: priceNum * 100,
        discount_price_bdt: discountPriceBdt ? Number(discountPriceBdt) : 0,
        currency: 'BDT',
        thumbnail_url: thumbnailUrl,
        learning_objectives: learningObjectives,
        what_you_will_learn: whatYouWillLearn,
        student_requirements: requirements,
        sections,
        approval_status: approvalStatus,
        is_published: approvalStatus === 'published'
      };

      const saved = await dbService.saveCourse(payload);
      addToast(
        approvalStatus === 'draft'
          ? 'Course saved as draft!'
          : approvalStatus === 'pending_review'
          ? 'Course submitted for admin review!'
          : `Course "${title}" published successfully!`,
        'success'
      );

      onCourseSaved && onCourseSaved(saved);
      onClose();
    } catch (err) {
      addToast(err.message || 'Failed to save course.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingCourse ? `Course Studio: ${existingCourse.title}` : 'Create English Course & Curriculum'}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 pb-2 gap-2 text-xs font-bold overflow-x-auto">
          {[
            { id: 'basic', label: '1. Course Details' },
            { id: 'curriculum', label: `2. Curriculum (${sections.reduce((a, s) => a + s.lessons.length, 0)} Lessons)` },
            { id: 'pricing', label: '3. Pricing & Discounts' },
            { id: 'preview', label: '4. Summary & Publish' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Course Details */}
        {activeTab === 'basic' && (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Course Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Fearless English Speaking: Fluency in 30 Days"
                className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Short Subtitle / Hook *
              </label>
              <input
                type="text"
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                placeholder="One sentence that summarizes the main learner transformation"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Full Course Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed curriculum overview, who this course is for, and methodology..."
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
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="Conversational Fluency">Conversational Fluency</option>
                  <option value="IELTS Exam Prep">IELTS Exam Prep</option>
                  <option value="Pronunciation">Pronunciation</option>
                  <option value="Workplace English">Workplace English</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Difficulty Level
                </label>
                <select
                  value={difficultyLevel}
                  onChange={(e) => setDifficultyLevel(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="All Levels">All Levels</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Language
                </label>
                <input
                  type="text"
                  value={courseLanguage}
                  onChange={(e) => setCourseLanguage(e.target.value)}
                  placeholder="English (US) / Bengali"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Course Thumbnail URL
              </label>
              <input
                type="text"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            {/* Learning Objectives */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Learning Objectives (Key Outcomes)
              </label>
              <div className="space-y-1.5 mb-2">
                {learningObjectives.map((obj, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{obj}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setLearningObjectives(learningObjectives.filter((_, i) => i !== idx))}
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
                  placeholder="Add another learning objective..."
                  className="flex-1 text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newObjective.trim()) {
                      setLearningObjectives([...learningObjectives, newObjective.trim()]);
                      setNewObjective('');
                    }
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTab('curriculum')}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white"
              >
                Next: Curriculum Builder →
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Curriculum Builder (Course -> Sections -> Lessons) */}
        {activeTab === 'curriculum' && (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Course Modules & Lessons
                </h4>
                <p className="text-xs text-slate-400">
                  Organize your course into sequential modules and structured video lessons with downloadable notes.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddSection}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Module</span>
              </button>
            </div>

            <div className="space-y-4">
              {sections.map((section, secIdx) => (
                <div
                  key={section.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  {/* Module Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        {secIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => {
                          const updated = [...sections];
                          updated[secIdx].title = e.target.value;
                          setSections(updated);
                        }}
                        className="flex-1 font-extrabold text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveSection(secIdx, -1)}
                        disabled={secIdx === 0}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSection(secIdx, 1)}
                        disabled={secIdx === sections.length - 1}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(secIdx)}
                        className="p-1.5 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
                        title="Delete Section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Lessons List inside this section */}
                  <div className="space-y-3 pl-3 sm:pl-6 border-l-2 border-indigo-500/30">
                    {section.lessons.map((lesson, lesIdx) => (
                      <div
                        key={lesson.id}
                        className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <Video className="w-4 h-4 text-indigo-500 shrink-0" />
                            <input
                              type="text"
                              value={lesson.title}
                              onChange={(e) => handleUpdateLesson(secIdx, lesIdx, 'title', e.target.value)}
                              placeholder="Lesson Title"
                              className="flex-1 font-bold p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800"
                            />
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Free Preview Toggle */}
                            <label className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer text-slate-500">
                              <input
                                type="checkbox"
                                checked={lesson.is_preview || false}
                                onChange={(e) => handleUpdateLesson(secIdx, lesIdx, 'is_preview', e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>Free Preview</span>
                            </label>

                            <input
                              type="text"
                              value={lesson.duration || '12 min'}
                              onChange={(e) => handleUpdateLesson(secIdx, lesIdx, 'duration', e.target.value)}
                              placeholder="12 min"
                              className="w-16 text-center font-mono text-[11px] p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                            />

                            <button
                              type="button"
                              onClick={() => handleRemoveLesson(secIdx, lesIdx)}
                              className="text-slate-400 hover:text-rose-500 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Video URL & Notes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-400 block mb-0.5">Video URL (MP4 or Embed):</span>
                            <input
                              type="text"
                              value={lesson.video_url || ''}
                              onChange={(e) => handleUpdateLesson(secIdx, lesIdx, 'video_url', e.target.value)}
                              placeholder="https://commondatastorage.googleapis.com/.../video.mp4"
                              className="w-full font-mono p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                            />
                          </div>

                          <div>
                            <span className="text-slate-400 block mb-0.5">PDF Handouts (upload, max 20 MB each):</span>
                            <label
                              className={`flex items-center justify-center gap-1.5 w-full p-1.5 rounded-lg border border-dashed border-indigo-400 text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-500/10 ${
                                uploadingLesson === `${secIdx}-${lesIdx}` ? 'opacity-60 pointer-events-none' : ''
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {uploadingLesson === `${secIdx}-${lesIdx}` ? 'Uploading...' : 'Upload PDF'}
                              <input
                                type="file"
                                accept="application/pdf,.pdf"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  handlePdfUpload(secIdx, lesIdx, e.target.files);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {Array.isArray(lesson.pdf_resources) && lesson.pdf_resources.length > 0 && (
                              <ul className="mt-1.5 space-y-1">
                                {lesson.pdf_resources.map((pdf, pdfIdx) => (
                                  <li
                                    key={pdfIdx}
                                    className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800"
                                  >
                                    <span className="truncate text-slate-700 dark:text-slate-200">
                                      {typeof pdf === 'string' ? pdf : pdf.name}
                                      {typeof pdf === 'object' && pdf.size
                                        ? ` (${(pdf.size / 1024 / 1024).toFixed(1)} MB)`
                                        : ''}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePdf(secIdx, lesIdx, pdfIdx)}
                                      className="p-1 text-rose-500 hover:bg-rose-500/10 rounded shrink-0"
                                      title="Remove PDF"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        {/* Lesson Content Text */}
                        <div>
                          <textarea
                            rows={2}
                            value={lesson.content_text || ''}
                            onChange={(e) => handleUpdateLesson(secIdx, lesIdx, 'content_text', e.target.value)}
                            placeholder="Text lesson instructions and transcription notes..."
                            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => handleAddLesson(secIdx)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 pt-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Lesson to Module
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 flex justify-between">
              <button
                type="button"
                onClick={() => setActiveTab('basic')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pricing')}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white"
              >
                Next: Pricing & Discounts →
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Pricing & Financials */}
        {activeTab === 'pricing' && (
          <div className="space-y-4">
            
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900 text-xs">
              <span className="font-extrabold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
                Platform Financial Split: 80% Mentor / 20% SayBD
              </span>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Student purchases through bKash, Nagad, or Cards are processed and verified automatically via SSLCommerz. Your 80% net earnings will credit to your available balance.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setIsFree(true); setPriceBdt('0'); }}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  isFree
                    ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <span className="font-bold text-xs block">Free Public Course</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Zero cost for all community members.</span>
              </button>

              <button
                type="button"
                onClick={() => { setIsFree(false); if (priceBdt === '0') setPriceBdt('1200'); }}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  !isFree
                    ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <span className="font-bold text-xs block">Paid Course (BDT ৳)</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">One-time student purchase with lifetime access.</span>
              </button>
            </div>

            {!isFree && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Regular Price in BDT (৳) *
                    </label>
                    <div className="relative">
                      <span className="text-sm font-bold text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2">৳</span>
                      <input
                        type="number"
                        min={100}
                        max={20000}
                        value={priceBdt}
                        onChange={(e) => setPriceBdt(e.target.value)}
                        placeholder="1200"
                        className="w-full text-xs font-mono font-bold pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Optional Discounted Offer Price (৳)
                    </label>
                    <div className="relative">
                      <span className="text-sm font-bold text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2">৳</span>
                      <input
                        type="number"
                        min={0}
                        max={Number(priceBdt) || 20000}
                        value={discountPriceBdt}
                        onChange={(e) => setDiscountPriceBdt(e.target.value)}
                        placeholder="e.g. 990"
                        className="w-full text-xs font-mono font-bold pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Revenue Calculator */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Retail Course Price:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">৳{Number(priceBdt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>SayBD Platform Fee (20%):</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">-৳{Math.round((Number(priceBdt) || 0) * 0.2).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-xs font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400">Your Net Earnings Per Sale (80%):</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                      +৳{Math.round((Number(priceBdt) || 0) * 0.8).toLocaleString()} BDT
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-3 flex justify-between">
              <button
                type="button"
                onClick={() => setActiveTab('curriculum')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white"
              >
                Next: Summary & Publish →
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Summary & Publish Actions */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            
            {/* Course Card Preview */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {category}
                </span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                  {isFree ? 'Free Access' : `৳${Number(priceBdt).toLocaleString()} BDT`}
                </span>
              </div>

              <h3 className="font-black text-base text-slate-900 dark:text-white">
                {title || 'Untitled Course'}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-2">
                {shortDesc || 'No summary entered yet.'}
              </p>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Curriculum</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {sections.reduce((a, s) => a + s.lessons.length, 0)} Lessons
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Difficulty</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{difficultyLevel}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Language</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{courseLanguage}</span>
                </div>
              </div>
            </div>

            {/* Actions for Publishing */}
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
                onClick={() => handleSaveCourse('draft')}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Save as Draft
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSaveCourse('pending_review')}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
              >
                Submit for Approval
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSaveCourse('published')}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all hover:scale-101"
              >
                {isSubmitting ? 'Publishing...' : 'Publish Course Now'}
              </button>
            </div>

          </div>
        )}

      </div>
    </Modal>
  );
}
