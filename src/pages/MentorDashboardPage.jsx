import React, { useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import { MentorDashboard } from '../features/mentor/MentorDashboard.jsx';
import { Plus, Video, BookOpen } from 'lucide-react';

export function MentorDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');

  // Map subkeys to display titles
  const getTabMetadata = () => {
    switch (activeTab) {
      case 'overview':
        return { title: 'Mentor Studio Overview', subtitle: 'Live stats, classrooms & course performance', breadcrumbs: ['Overview'] };
      case 'classes':
      case 'all-classes':
        return { title: 'Live Classes Management', subtitle: 'Schedule, edit, and host live classes', breadcrumbs: ['Classes', 'All'] };
      case 'upcoming-classes':
        return { title: 'Upcoming Scheduled Classes', subtitle: 'Classes scheduled for upcoming dates', breadcrumbs: ['Classes', 'Upcoming'] };
      case 'live-classes':
      case 'classrooms':
        return { title: 'Interactive Live Classrooms', subtitle: 'LiveKit SFU multi-student live sessions', breadcrumbs: ['Classrooms'] };
      case 'completed-classes':
        return { title: 'Completed Live Classes', subtitle: 'Past sessions archive and student attendance', breadcrumbs: ['Classes', 'Completed'] };
      case 'courses':
      case 'my-courses':
        return { title: 'Course Management', subtitle: 'Curate video curriculums and learning resources', breadcrumbs: ['Courses'] };
      case 'course-students':
      case 'students':
        return { title: 'Enrolled Students Roster', subtitle: 'Student directory and completion metrics', breadcrumbs: ['Students'] };
      case 'course-sales':
      case 'earnings':
      case 'payouts':
        return { title: 'Mentor Earnings & SSLCOMMERZ Sales', subtitle: 'Verified course purchases and bKash / bank payouts', breadcrumbs: ['Earnings'] };
      case 'reviews':
      case 'reviews-feedback':
        return { title: 'Student Reviews & Feedback', subtitle: 'Ratings and comments from completed classes', breadcrumbs: ['Reviews'] };
      case 'notifications':
        return { title: 'Mentor Notifications', subtitle: 'Enrollment alerts, schedule reminders and reviews', breadcrumbs: ['Notifications'] };
      case 'profile':
      case 'my-profile':
      case 'settings':
        return { title: 'Mentor Profile & Settings', subtitle: 'Bio, credentials, and teaching subjects', breadcrumbs: ['Profile'] };
      default:
        return { title: 'Mentor Studio', subtitle: '', breadcrumbs: [] };
    }
  };

  const metadata = getTabMetadata();

  return (
    <DashboardLayout
      role="mentor"
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      pageTitle={metadata.title}
      pageSubtitle={metadata.subtitle}
      breadcrumbs={metadata.breadcrumbs}
    >
      <div className="space-y-4">
        {/* Render the full-featured MentorDashboard system */}
        <MentorDashboard activeTabProp={activeTab} onTabChange={setActiveTab} />
      </div>
    </DashboardLayout>
  );
}
