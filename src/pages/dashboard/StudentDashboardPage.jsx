import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout.jsx';
import { StudentOverview } from '../../features/student/StudentOverview.jsx';
import { PracticePage } from '../PracticePage.jsx';
import { PracticeHistoryView } from '../../features/student/PracticeHistoryView.jsx';
import { CoursesPage } from '../CoursesPage.jsx';
import { CourseCatalog } from '../../features/courses/CourseCatalog.jsx';
import { StudentClassesView } from '../../features/student/StudentClassesView.jsx';
import { SpeakingLeaderboard } from '../../features/leaderboard/SpeakingLeaderboard.jsx';
import { ProfilePage } from '../ProfilePage.jsx';
import { MonthlyPracticeCalendar } from '../../components/speaking/MonthlyPracticeCalendar.jsx';
import { ShareProgressModal } from '../../components/speaking/ShareProgressModal.jsx';
import { StudentPaymentsView } from '../../features/student/StudentPaymentsView.jsx';
import { NotificationsCenterView } from '../../features/student/NotificationsCenterView.jsx';
import { AccountSettingsView } from '../../features/student/AccountSettingsView.jsx';
import { Mic, Share2 } from 'lucide-react';


export function StudentDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Map activeTab to display titles and breadcrumbs
  const getTabMetadata = () => {
    switch (activeTab) {
      case 'overview':
        return { title: 'Student Dashboard', subtitle: 'Welcome to your speaking practice hub', breadcrumbs: ['Overview'] };
      case 'find-partner':
        return { title: '1-on-1 Speaking Practice', subtitle: 'Connect with a peer for conversational English', breadcrumbs: ['Practice', 'Find Partner'] };
      case 'practice-history':
        return { title: 'Practice History & Logs', subtitle: 'View past peer conversations & recorded feedback', breadcrumbs: ['Practice', 'History'] };
      case 'browse-courses':
        return { title: 'Browse All Courses', subtitle: 'Curated spoken English curriculums by verified mentors', breadcrumbs: ['Learn', 'Browse'] };
      case 'my-courses':
        return { title: 'My Enrolled Courses', subtitle: 'Resume your active video lessons and interactive exercises', breadcrumbs: ['Learn', 'My Courses'] };
      case 'learning-progress':
        return { title: 'Learning Progress & Stats', subtitle: 'Track lesson completions and practice milestones', breadcrumbs: ['Learn', 'Progress'] };
      case 'upcoming-classes':
        return { title: 'Upcoming Live Classes', subtitle: 'Interactive live sessions scheduled by mentors', breadcrumbs: ['Classes', 'Upcoming'] };
      case 'completed-classes':
        return { title: 'Past Live Classes', subtitle: 'Classroom archives and notes', breadcrumbs: ['Classes', 'Completed'] };
      case 'leaderboard':
        return { title: 'Speaking Time Leaderboard', subtitle: 'Regional and weekly practice rankings across Bangladesh', breadcrumbs: ['Leaderboard'] };
      case 'profile-info':
      case 'profile':
        return { title: 'My Speaking Profile', subtitle: 'Manage your learner profile and public stats', breadcrumbs: ['Profile', 'Info'] };
      case 'monthly-calendar':
        return { title: 'Monthly Practice Calendar', subtitle: 'Consistent daily practice heatmap', breadcrumbs: ['Profile', 'Calendar'] };
      case 'share-progress':
        return { title: 'Share My Progress Card', subtitle: 'Generate and download your speaking achievement cards', breadcrumbs: ['Profile', 'Share'] };
      case 'payment-history':
      case 'subscription':
      case 'payments':
        return { title: 'Billing & Subscriptions', subtitle: 'Verified SSLCOMMERZ receipts and practice tier memberships', breadcrumbs: ['Payments'] };
      case 'notifications':
        return { title: 'Notifications Center', subtitle: 'Class reminders, system notices, and feedback', breadcrumbs: ['Notifications'] };
      case 'settings':
      case 'edit-profile':
        return { title: 'Account Settings & Security', subtitle: 'Personal preferences and timezone settings', breadcrumbs: ['Settings'] };
      default:
        return { title: 'Student Dashboard', subtitle: '', breadcrumbs: [] };
    }
  };

  const metadata = getTabMetadata();

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <StudentOverview onNavigateTab={setActiveTab} />;

      case 'find-partner':
        return (
          <div className="space-y-4">
            <PracticePage />
          </div>
        );

      case 'practice-history':
        return <PracticeHistoryView />;

      case 'browse-courses':
      case 'my-courses':
      case 'learning-progress':
        return <CoursesPage />;

      case 'upcoming-classes':
        return <StudentClassesView initialFilter="upcoming" />;

      case 'completed-classes':
        return <StudentClassesView initialFilter="completed" />;

      case 'leaderboard':
        return <SpeakingLeaderboard />;

      case 'profile-info':
      case 'profile':
      case 'edit-profile':
        return <ProfilePage />;

      case 'monthly-calendar':
        return (
          <div className="max-w-2xl bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              Monthly Speaking Practice Heatmap
            </h3>
            <MonthlyPracticeCalendar />
          </div>
        );

      case 'share-progress':
        return (
          <div className="max-w-xl bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Share Speaking Milestones
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Generate a shareable graphic showing your practice streaks, minutes spoken, and tier badges.
            </p>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm"
            >
              <Share2 className="w-4 h-4" />
              <span>Open Card Generator</span>
            </button>
          </div>
        );

      case 'payment-history':
      case 'subscription':
      case 'payments':
        return <StudentPaymentsView />;

      case 'notifications':
        return <NotificationsCenterView />;

      case 'settings':
        return <AccountSettingsView />;

      default:
        return <StudentOverview onNavigateTab={setActiveTab} />;
    }
  };

  return (
    <>
      <DashboardLayout
        role="student"
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pageTitle={metadata.title}
        pageSubtitle={metadata.subtitle}
        breadcrumbs={metadata.breadcrumbs}
        extraTopbarAction={
          activeTab !== 'find-partner' && (
            <button
              onClick={() => setActiveTab('find-partner')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Practice Now</span>
            </button>
          )
        }
      >
        {renderContent()}
      </DashboardLayout>

      {/* Share Progress Modal */}
      {isShareModalOpen && (
        <ShareProgressModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
    </>
  );
}
