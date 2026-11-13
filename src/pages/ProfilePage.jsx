import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNotification } from '../contexts/NotificationContext.jsx';
import { dbService } from '../services/supabase/dbService.js';
import { ProfilePictureUploader } from '../components/profile/ProfilePictureUploader.jsx';
import { MonthlyPracticeCalendar } from '../components/speaking/MonthlyPracticeCalendar.jsx';
import { CoursePlayer } from '../features/courses/CoursePlayer.jsx';
import { MentorEarningsDashboard } from '../features/mentor/MentorEarningsDashboard.jsx';
import { COMMUNITY_STATUS, ROLES } from '../config/constants.js';
import { formatSecondsToTimer } from '../utils/formatters.js';
import { Link } from 'react-router-dom';
import {
  User,
  Shield,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Save,
  Globe,
  Award,
  BookOpen,
  Play,
  ArrowRight,
  ChevronRight,
  GraduationCap,
  Video,
  Languages,
  Briefcase,
  Target,
  DollarSign
} from 'lucide-react';

export function ProfilePage() {
  const { currentUser, updateProfile, remainingSeconds, maxAllowanceSeconds, isApproved } = useAuth();
  const { addToast } = useNotification();

  // Common Profile Edit States
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [nativeLanguage, setNativeLanguage] = useState(currentUser?.native_language || 'Bengali');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [country, setCountry] = useState(currentUser?.country || 'Bangladesh');
  const [location, setLocation] = useState(currentUser?.location || 'Dhaka, Bangladesh');
  const [learningGoals, setLearningGoals] = useState(currentUser?.learning_goals || 'IELTS Band 7.5 & Workplace Fluency');

  // Mentor-Specific Profile States
  const [mentorTitle, setMentorTitle] = useState('Senior IELTS & Fluency Coach');
  const [mentorBio, setMentorBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState(5);
  const [expertise, setExpertise] = useState('IELTS Speaking Band 7+, Accent Reduction, Job Interview Prep');
  const [languages, setLanguages] = useState('English (US), Bengali');
  const [intro, setIntro] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // Purchased courses state (for students)
  const [purchasedCourses, setPurchasedCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [playingCourse, setPlayingCourse] = useState(null);

  // Mentor classes state (for mentors)
  const [mentorClasses, setMentorClasses] = useState([]);

  // Load user data on mount or user switch
  useEffect(() => {
    if (!currentUser?.id) return;
    setFullName(currentUser.full_name || '');
    setNativeLanguage(currentUser.native_language || 'Bengali');
    setBio(currentUser.bio || '');
    setCountry(currentUser.country || 'Bangladesh');
    setLocation(currentUser.location || 'Dhaka, Bangladesh');
    setLearningGoals(currentUser.learning_goals || 'IELTS Band 7.5 & Workplace Fluency');

    if (currentUser.role === ROLES.STUDENT) {
      loadPurchasedCourses();
    } else if (currentUser.role === ROLES.MENTOR) {
      loadMentorData();
    }
  }, [currentUser?.id, currentUser?.role]);

  // Fetch student's purchased courses
  const loadPurchasedCourses = async () => {
    if (!currentUser?.id) return;
    setLoadingCourses(true);
    try {
      const courses = await dbService.getPurchasedCourses(currentUser.id);
      setPurchasedCourses(courses || []);
    } finally {
      setLoadingCourses(false);
    }
  };

  // Fetch mentor profile details and classes
  const loadMentorData = async () => {
    if (!currentUser?.id) return;
    try {
      const mentor = await dbService.getMentor(currentUser.id);
      if (mentor) {
        setMentorTitle(mentor.title || 'Senior IELTS & Fluency Coach');
        setMentorBio(mentor.bio || currentUser.bio || '');
        setYearsExperience(mentor.years_experience || 5);
        setExpertise(Array.isArray(mentor.expertise) ? mentor.expertise.join(', ') : mentor.expertise || '');
        setLanguages(Array.isArray(mentor.languages) ? mentor.languages.join(', ') : 'English, Bengali');
        setIntro(mentor.intro || '');
      }
      const classes = await dbService.getLiveClasses();
      setMentorClasses(classes.filter((c) => c.mentor_id === currentUser.id));
    } catch (err) {
      console.warn('Failed to load mentor data:', err);
    }
  };

  // Submit Profile Edits
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // 1. Update core profile record (safe fields only; cannot alter role or status)
      await updateProfile({
        full_name: fullName,
        native_language: nativeLanguage,
        bio,
        country,
        location,
        learning_goals: learningGoals,
      });

      // 2. If mentor, also update mentors table
      if (currentUser?.role === ROLES.MENTOR) {
        await dbService.updateMentor(currentUser.id, {
          title: mentorTitle,
          bio: mentorBio || bio,
          years_experience: parseInt(yearsExperience, 10) || 5,
          expertise: expertise.split(',').map((s) => s.trim()).filter(Boolean),
          languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
          intro,
        });
      }

      addToast('Profile changes saved successfully!', 'success');
    } catch (err) {
      console.error('Error saving profile:', err);
      addToast('Failed to update profile.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Course player full view if student clicked "Continue Learning"
  if (playingCourse) {
    return (
      <div className="py-2">
        <CoursePlayer
          course={playingCourse}
          onBack={() => {
            setPlayingCourse(null);
            loadPurchasedCourses();
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      
      {/* 1. Top Profile Overview & Common Profile Picture Management Card */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 sm:space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 pb-5 sm:pb-6 border-b border-slate-100 dark:border-slate-800">
          
          {/* Common Profile Picture Uploader for Student, Mentor, and Admin */}
          <ProfilePictureUploader
            user={currentUser}
            onImageUpdated={(newAvatarUrl) => {
              updateProfile({ avatar_url: newAvatarUrl });
            }}
          />

          {/* Role & Community Status Badge */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs shrink-0 sm:self-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Account Status & Role
            </span>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {currentUser?.role}
              </span>
              {isApproved ? (
                <div className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approved Member</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 font-bold text-amber-500">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Pending Review</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              {currentUser?.email}
            </p>
          </div>

        </div>

        {/* Quick Role Description Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span>Location: <strong>{location || country}</strong></span>
            <span>•</span>
            <span>Native Language: <strong className="text-indigo-600 dark:text-indigo-400">{nativeLanguage}</strong></span>
          </div>

          {currentUser?.role === 'student' && (
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatSecondsToTimer(remainingSeconds)} daily allowance left</span>
            </div>
          )}
        </div>

      </div>

      {/* 2. STUDENT-SPECIFIC CONTENT: Practice Calendar & Purchased Courses */}
      {currentUser?.role === ROLES.STUDENT && (
        <>
          {/* Monthly Daily Speaking Practice Calendar */}
          <section className="space-y-2">
            <MonthlyPracticeCalendar userId={currentUser?.id} />
          </section>

          {/* My Purchased Courses */}
          <section className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    My Purchased Courses
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    All video masterclasses and learning resources you have successfully enrolled in.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {purchasedCourses.length} Enrolled
              </span>
            </div>

            {purchasedCourses.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                You haven't purchased any courses yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {purchasedCourses.map((course) => (
                  <div
                    key={course.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800/80 hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <img
                        src={course.thumbnail_url || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=300'}
                        alt={course.title}
                        className="w-20 h-16 sm:w-24 sm:h-20 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 inline-block mb-1">
                          {course.enrollment_status || 'Active Enrollment'}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {course.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Mentor: <strong>{course.mentor_name}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {course.progress_percentage || 0}% Completed
                      </span>

                      <button
                        onClick={() => setPlayingCourse(course)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all hover:scale-102"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Continue Learning</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* 3. MENTOR-SPECIFIC CONTENT: Live Classes & Courses */}
      {currentUser?.role === ROLES.MENTOR && (
        <section className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  My Live Classrooms & Masterclasses
                </h2>
                <p className="text-xs text-slate-400">
                  Manage your interactive speaking rooms and classroom schedule.
                </p>
              </div>
            </div>
            <Link
              to="/classes"
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
            >
              Open Classrooms
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {mentorClasses.map((cls) => (
              <div
                key={cls.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    cls.status === 'live' ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {cls.status}
                  </span>
                  <span className="text-xs text-slate-400">{cls.duration_minutes} mins</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{cls.title}</h4>
                <p className="text-xs text-slate-500 line-clamp-2">{cls.description}</p>
              </div>
            ))}
          </div>

          {/* Mentor Earnings & Payout Dashboard */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span>Earnings, Commission & Payout Management</span>
            </h3>
            <MentorEarningsDashboard />
          </div>
        </section>
      )}

      {/* 4. ADMIN-SPECIFIC CONTENT: Quick Link to Admin Console */}
      {currentUser?.role === ROLES.ADMIN && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">SayBD Administration Console</h3>
              <p className="text-xs text-slate-300">
                Manage community safety approvals, reports, user suspensions, and platform settings.
              </p>
            </div>
          </div>
          <Link
            to="/admin"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
          >
            <span>Open Admin Console</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* 5. ROLE-AWARE PROFILE EDITING FORM */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 sm:space-y-6">
        <div>
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-500" />
            <span>
              {currentUser?.role === ROLES.MENTOR
                ? 'Mentor Professional Profile'
                : currentUser?.role === ROLES.ADMIN
                ? 'Admin Profile Information'
                : 'Student Learning Profile'}
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentUser?.role === ROLES.MENTOR
              ? 'Update your teaching credentials, expertise, and languages spoken.'
              : currentUser?.role === ROLES.ADMIN
              ? 'Update your administrator display name and contact bio.'
              : 'Personalize your speaking community details, goals, and location.'}
          </p>
        </div>

        {/* COMMON FIELDS: Name, Country, Native Language */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Display Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Native Language (First Language)
            </label>
            <input
              type="text"
              value={nativeLanguage}
              onChange={(e) => setNativeLanguage(e.target.value)}
              placeholder="e.g. Bengali, English (US), Hindi"
              className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Country or Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Dhaka, Bangladesh"
              className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* STUDENT SPECIFIC: Learning Goals */}
        {currentUser?.role === ROLES.STUDENT && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-500" />
              <span>English Learning Goals (Optional)</span>
            </label>
            <input
              type="text"
              value={learningGoals}
              onChange={(e) => setLearningGoals(e.target.value)}
              placeholder="e.g. IELTS Band 7.5+, Job Interview Prep, Casual Fluency"
              className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* MENTOR SPECIFIC: Professional Title, Experience, Expertise, Languages */}
        {currentUser?.role === ROLES.MENTOR && (
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Professional Title
                </label>
                <input
                  type="text"
                  value={mentorTitle}
                  onChange={(e) => setMentorTitle(e.target.value)}
                  placeholder="e.g. Senior IELTS & Fluency Coach"
                  className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Teaching Experience (Years)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Teaching Expertise (Comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={expertise}
                  onChange={(e) => setExpertise(e.target.value)}
                  placeholder="e.g. IELTS Speaking Band 7+, Accent Reduction, Public Speaking"
                  className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Languages Spoken</span>
                </label>
                <input
                  type="text"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder="e.g. English, Bengali, Hindi"
                  className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* BIO / INTRODUCTION TEXTAREA */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
            {currentUser?.role === ROLES.MENTOR ? 'Professional Bio & Teaching Methodology' : 'Bio & Introduction'}
          </label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={
              currentUser?.role === ROLES.MENTOR
                ? 'Describe your instructional approach, certifications, and how you help students build spontaneous fluency...'
                : 'Share why you are practicing English (e.g., preparing for IELTS, job interviews, or casual conversation)...'
            }
            className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Bottom Bar with Save Button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="text-[11px] text-slate-400">
            Account role & verification status are protected by SayBD safety policy.
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all hover:scale-102"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>

    </div>
  );
}
