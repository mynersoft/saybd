import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/supabase/dbService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { CourseDetail } from './CourseDetail.jsx';
import { CoursePlayer } from './CoursePlayer.jsx';
import { MentorCourseEditor } from './MentorCourseEditor.jsx';
import { formatCurrency } from '../../utils/formatters.js';
import {
  BookOpen,
  Search,
  Star,
  Users,
  Play,
  CheckCircle2,
  Plus,
  Sparkles,
  ChevronRight
} from 'lucide-react';

export function CourseCatalog() {
  const { currentUser, isMentor } = useAuth();
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [playingCourse, setPlayingCourse] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All', 'Conversational Fluency', 'IELTS Exam Prep', 'Pronunciation', 'Workplace English'];

  const loadData = async () => {
    const list = await dbService.getCourses();
    setCourses(list);
    const userEnrollments = await dbService.getEnrollments(currentUser.id);
    setEnrollments(userEnrollments);
  };

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const filtered = courses.filter((c) => {
    const matchCat = categoryFilter === 'All' || c.category === categoryFilter;
    const matchSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mentor_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  // If in learning player view
  if (playingCourse) {
    return (
      <CoursePlayer
        course={playingCourse}
        onBack={() => {
          setPlayingCourse(null);
          loadData();
        }}
      />
    );
  }

  // If viewing course syllabus detail view
  if (selectedCourse) {
    const isEnrolled = enrollments.includes(selectedCourse.id);
    return (
      <CourseDetail
        course={selectedCourse}
        isEnrolled={isEnrolled}
        onBack={() => setSelectedCourse(null)}
        onStartLearning={() => {
          setSelectedCourse(null);
          setPlayingCourse(selectedCourse);
        }}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white shadow-xl">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Mentor English Video Masterclasses</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            English Course Marketplace
          </h1>
          <p className="text-xs sm:text-sm text-indigo-100/80 mt-1">
            Master speaking fluency, IELTS Band 7+, and business vocabulary with structured step-by-step video lessons and practice worksheets.
          </p>
        </div>

        {isMentor && (
          <button
            onClick={() => setIsEditorOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Course</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses or topics..."
              className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          {/* Categories Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  categoryFilter === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Course Cards Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 space-y-3">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto opacity-60" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {searchQuery ? 'No matching courses found' : 'No courses published yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? 'Try modifying your search or clearing the category filter.'
              : 'Our verified mentors are preparing new courses. Check back soon or check our live classrooms!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((course) => {
            const isEnrolled = enrollments.includes(course.id);
          const totalLessons = course.sections?.reduce((acc, sec) => acc + sec.lessons.length, 0) || 0;

          return (
            <div
              key={course.id}
              className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-xl hover:border-indigo-500/40 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={course.thumbnail_url || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&auto=format&fit=crop&q=80'}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-950/70 backdrop-blur-md text-white">
                    {course.category}
                  </div>
                  {isEnrolled && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-sm flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Enrolled
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">{course.level}</span>
                    <div className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{course.rating ? Number(course.rating).toFixed(1) : 'New'}</span>
                    </div>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {course.title}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {course.subtitle}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-slate-400">By {course.mentor_name}</span>
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      {totalLessons} Lessons
                    </span>
                  </div>
                </div>
              </div>

              {/* Price & CTA */}
              <div className="p-5 pt-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {formatCurrency(course.price_cents, course.currency)}
                  </span>
                  <span className="text-[11px] text-slate-400">Lifetime Access</span>
                </div>

                {isEnrolled ? (
                  <button
                    onClick={() => setPlayingCourse(course)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Watch Lessons</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setSelectedCourse(course)}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <span>View Syllabus & Enroll</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}

      <MentorCourseEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        currentUser={currentUser}
        onSave={() => {
          setIsEditorOpen(false);
          loadData();
        }}
      />
    </div>
  );
}
