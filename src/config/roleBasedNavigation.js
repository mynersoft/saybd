import {
  LayoutDashboard,
  Mic,
  BookOpen,
  Calendar,
  Trophy,
  User,
  CreditCard,
  Bell,
  Settings,
  Radio,
  Users,
  DollarSign,
  Star,
  Shield,
  FileCheck,
  CheckCircle,
  GraduationCap,
  History,
  TrendingUp,
  Receipt,
  FileText,
  Sliders,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  HelpCircle
} from 'lucide-react';

/**
 * Centralized Role-Based Navigation Configuration
 * Defines groups, items, nested subitems, and route paths for Student, Mentor, and Admin roles.
 */
export const ROLE_NAVIGATION = {
  student: [
    {
      group: 'Overview',
      items: [
        { id: 'student-overview', label: 'Dashboard Home', path: '/dashboard/student', icon: LayoutDashboard }
      ]
    },
    {
      group: 'Practice',
      items: [
        { id: 'practice-find', label: 'Find Partner', path: '/dashboard/student/practice', icon: Mic, badge: 'Live 1-on-1' },
        { id: 'practice-history', label: 'Practice History', path: '/dashboard/student/practice-history', icon: History }
      ]
    },
    {
      group: 'Learn',
      items: [
        { id: 'learn-browse', label: 'Browse Courses', path: '/dashboard/student/courses', icon: BookOpen },
        { id: 'learn-purchased', label: 'My Purchased Courses', path: '/dashboard/student/my-courses', icon: GraduationCap },
        { id: 'learn-progress', label: 'Learning Progress', path: '/dashboard/student/learning-progress', icon: TrendingUp }
      ]
    },
    {
      group: 'My Classes',
      items: [
        { id: 'classes-upcoming', label: 'Upcoming Classes', path: '/dashboard/student/classes-upcoming', icon: Calendar },
        { id: 'classes-completed', label: 'Completed Classes', path: '/dashboard/student/classes-completed', icon: CheckCircle }
      ]
    },
    {
      group: 'Leaderboard',
      items: [
        { id: 'student-leaderboard', label: 'Speaking Time Ranking', path: '/dashboard/student/leaderboard', icon: Trophy, badge: 'Top 3' }
      ]
    },
    {
      group: 'My Profile',
      items: [
        { id: 'profile-info', label: 'Profile Information', path: '/dashboard/student/profile', icon: User },
        { id: 'profile-calendar', label: 'Monthly Practice Calendar', path: '/dashboard/student/calendar', icon: Calendar },
        { id: 'profile-share', label: 'Share My Progress', path: '/dashboard/student/share-progress', icon: Sparkles }
      ]
    },
    {
      group: 'Payments',
      items: [
        { id: 'payments-history', label: 'Payment History', path: '/dashboard/student/payments', icon: Receipt },
        { id: 'payments-subscription', label: 'Subscription Details', path: '/dashboard/student/subscription', icon: CreditCard }
      ]
    },
    {
      group: 'Notifications',
      items: [
        { id: 'student-notifications', label: 'All Notifications', path: '/dashboard/student/notifications', icon: Bell }
      ]
    },
    {
      group: 'Settings',
      items: [
        { id: 'student-settings', label: 'Account Settings', path: '/dashboard/student/settings', icon: Settings }
      ]
    }
  ],

  mentor: [
    {
      group: 'Overview',
      items: [
        { id: 'mentor-overview', label: 'Dashboard Home', path: '/dashboard/mentor', icon: LayoutDashboard }
      ]
    },
    {
      group: 'My Classes',
      items: [
        { id: 'mentor-classes-all', label: 'All Classes', path: '/dashboard/mentor/classes', icon: Calendar },
        { id: 'mentor-classes-upcoming', label: 'Upcoming Classes', path: '/dashboard/mentor/classes-upcoming', icon: Calendar },
        { id: 'mentor-classes-completed', label: 'Completed Classes', path: '/dashboard/mentor/classes-completed', icon: CheckCircle },
        { id: 'mentor-classes-draft', label: 'Draft Classes', path: '/dashboard/mentor/classes-draft', icon: FileText }
      ]
    },
    {
      group: 'My Classrooms',
      items: [
        { id: 'mentor-classrooms-live', label: 'Live Classrooms', path: '/dashboard/mentor/classrooms-live', icon: Radio, badge: 'LIVE' },
        { id: 'mentor-classrooms-scheduled', label: 'Scheduled Classrooms', path: '/dashboard/mentor/classrooms-scheduled', icon: Calendar },
        { id: 'mentor-classrooms-history', label: 'Classroom History', path: '/dashboard/mentor/classrooms-history', icon: History }
      ]
    },
    {
      group: 'My Courses',
      items: [
        { id: 'mentor-courses-all', label: 'All Courses', path: '/dashboard/mentor/courses', icon: BookOpen },
        { id: 'mentor-courses-create', label: 'Create New Course', path: '/dashboard/mentor/courses-create', icon: BookOpen },
        { id: 'mentor-courses-published', label: 'Published Courses', path: '/dashboard/mentor/courses-published', icon: CheckCircle },
        { id: 'mentor-courses-draft', label: 'Draft Courses', path: '/dashboard/mentor/courses-draft', icon: FileText },
        { id: 'mentor-courses-pending', label: 'Pending Approval', path: '/dashboard/mentor/courses-pending', icon: HelpCircle }
      ]
    },
    {
      group: 'Course Students',
      items: [
        { id: 'mentor-students-enrolled', label: 'Enrolled Students', path: '/dashboard/mentor/students', icon: Users },
        { id: 'mentor-students-progress', label: 'Student Progress', path: '/dashboard/mentor/students-progress', icon: TrendingUp }
      ]
    },
    {
      group: 'Course Sales',
      items: [
        { id: 'mentor-sales', label: 'Sales Transactions', path: '/dashboard/mentor/sales', icon: Receipt }
      ]
    },
    {
      group: 'Earnings',
      items: [
        { id: 'mentor-earnings-overview', label: 'Earnings Overview', path: '/dashboard/mentor/earnings', icon: DollarSign },
        { id: 'mentor-earnings-available', label: 'Available Balance', path: '/dashboard/mentor/earnings-available', icon: DollarSign },
        { id: 'mentor-earnings-pending', label: 'Pending Balance', path: '/dashboard/mentor/earnings-pending', icon: DollarSign },
        { id: 'mentor-withdrawals', label: 'Withdrawal Requests', path: '/dashboard/mentor/withdrawals', icon: CreditCard }
      ]
    },
    {
      group: 'Reviews & Feedback',
      items: [
        { id: 'mentor-reviews', label: 'Course Reviews', path: '/dashboard/mentor/reviews', icon: Star },
        { id: 'mentor-feedback', label: 'Student Feedback', path: '/dashboard/mentor/feedback', icon: Star }
      ]
    },
    {
      group: 'Notifications',
      items: [
        { id: 'mentor-notifications', label: 'All Notifications', path: '/dashboard/mentor/notifications', icon: Bell }
      ]
    },
    {
      group: 'My Profile',
      items: [
        { id: 'mentor-profile-view', label: 'View Profile', path: '/dashboard/mentor/profile', icon: User },
        { id: 'mentor-profile-edit', label: 'Edit Profile', path: '/dashboard/mentor/profile-edit', icon: User }
      ]
    },
    {
      group: 'Settings',
      items: [
        { id: 'mentor-settings', label: 'Account Settings', path: '/dashboard/mentor/settings', icon: Settings }
      ]
    }
  ],

  admin: [
    {
      group: 'Overview',
      items: [
        { id: 'admin-overview', label: 'Platform Analytics', path: '/dashboard/admin', icon: LayoutDashboard },
        { id: 'admin-home', label: 'Dashboard Home', path: '/dashboard/admin/home', icon: LayoutDashboard }
      ]
    },
    {
      group: 'User Management',
      items: [
        { id: 'admin-users-all', label: 'All Users', path: '/dashboard/admin/users', icon: Users },
        { id: 'admin-users-students', label: 'Students', path: '/dashboard/admin/students', icon: Users },
        { id: 'admin-users-mentors', label: 'Mentors', path: '/dashboard/admin/mentors', icon: Shield },
        { id: 'admin-users-admins', label: 'Admins', path: '/dashboard/admin/admins', icon: Shield },
        { id: 'admin-users-status', label: 'Account Status', path: '/dashboard/admin/user-status', icon: FileCheck }
      ]
    },
    {
      group: 'Mentor Management',
      items: [
        { id: 'admin-mentors-pending', label: 'Pending Mentor Approvals', path: '/dashboard/admin/mentor-approvals', icon: HelpCircle },
        { id: 'admin-mentors-verified', label: 'Verified Mentors', path: '/dashboard/admin/verified-mentors', icon: Shield },
        { id: 'admin-mentors-mgmt', label: 'Mentor Management', path: '/dashboard/admin/mentor-management', icon: Users }
      ]
    },
    {
      group: 'Class Management',
      items: [
        { id: 'admin-classes-all', label: 'All Classes', path: '/dashboard/admin/classes', icon: Calendar },
        { id: 'admin-classes-upcoming', label: 'Upcoming Classes', path: '/dashboard/admin/classes-upcoming', icon: Calendar },
        { id: 'admin-classes-completed', label: 'Completed Classes', path: '/dashboard/admin/classes-completed', icon: CheckCircle },
        { id: 'admin-classes-cancelled', label: 'Cancelled Classes', path: '/dashboard/admin/classes-cancelled', icon: AlertTriangle }
      ]
    },
    {
      group: 'Classroom Management',
      items: [
        { id: 'admin-classrooms-live', label: 'Live Classrooms', path: '/dashboard/admin/classrooms-live', icon: Radio, badge: 'LIVE' },
        { id: 'admin-classrooms-scheduled', label: 'Scheduled Classrooms', path: '/dashboard/admin/classrooms-scheduled', icon: Calendar },
        { id: 'admin-classrooms-history', label: 'Classroom History', path: '/dashboard/admin/classrooms-history', icon: History }
      ]
    },
    {
      group: 'Course Management',
      items: [
        { id: 'admin-courses-all', label: 'All Courses', path: '/dashboard/admin/courses', icon: BookOpen },
        { id: 'admin-courses-pending', label: 'Pending Course Approval', path: '/dashboard/admin/courses-pending', icon: HelpCircle },
        { id: 'admin-courses-published', label: 'Published Courses', path: '/dashboard/admin/courses-published', icon: CheckCircle },
        { id: 'admin-courses-unpublished', label: 'Unpublished Courses', path: '/dashboard/admin/courses-unpublished', icon: FileText },
        { id: 'admin-courses-reports', label: 'Course Reports', path: '/dashboard/admin/course-reports', icon: AlertTriangle }
      ]
    },
    {
      group: 'Enrollment Management',
      items: [
        { id: 'admin-enrollments-all', label: 'All Enrollments', path: '/dashboard/admin/enrollments', icon: Users },
        { id: 'admin-enrollments-details', label: 'Course Enrollment Details', path: '/dashboard/admin/enrollment-details', icon: FileText }
      ]
    },
    {
      group: 'Payments',
      items: [
        { id: 'admin-payments-orders', label: 'Orders', path: '/dashboard/admin/orders', icon: Receipt },
        { id: 'admin-payments-tx', label: 'Payment Transactions', path: '/dashboard/admin/transactions', icon: CreditCard },
        { id: 'admin-payments-failed', label: 'Failed Payments', path: '/dashboard/admin/failed-payments', icon: AlertTriangle },
        { id: 'admin-payments-refunds', label: 'Refund Management', path: '/dashboard/admin/refunds', icon: RotateCcw }
      ]
    },
    {
      group: 'Earnings & Payouts',
      items: [
        { id: 'admin-payouts-commission', label: 'Platform Commission', path: '/dashboard/admin/commission', icon: DollarSign },
        { id: 'admin-payouts-mentor', label: 'Mentor Earnings', path: '/dashboard/admin/mentor-earnings', icon: DollarSign },
        { id: 'admin-payouts-withdrawals', label: 'Withdrawal Requests', path: '/dashboard/admin/withdrawal-requests', icon: CreditCard },
        { id: 'admin-payouts-completed', label: 'Completed Payouts', path: '/dashboard/admin/completed-payouts', icon: CheckCircle }
      ]
    },
    {
      group: 'Leaderboard',
      items: [
        { id: 'admin-leaderboard', label: 'Speaking Time Rankings', path: '/dashboard/admin/leaderboard', icon: Trophy }
      ]
    },
    {
      group: 'Moderation',
      items: [
        { id: 'admin-mod-reports', label: 'User Reports', path: '/dashboard/admin/reports', icon: AlertTriangle },
        { id: 'admin-mod-reviews', label: 'Course Reviews', path: '/dashboard/admin/reviews', icon: Star },
        { id: 'admin-mod-reported-content', label: 'Reported Content', path: '/dashboard/admin/moderation', icon: AlertTriangle }
      ]
    },
    {
      group: 'Notifications',
      items: [
        { id: 'admin-announcements', label: 'Platform Announcements', path: '/dashboard/admin/announcements', icon: Bell }
      ]
    },
    {
      group: 'Platform Settings',
      items: [
        { id: 'admin-settings-general', label: 'General Settings', path: '/dashboard/admin/settings-general', icon: Settings },
        { id: 'admin-settings-practice', label: 'Practice Limits', path: '/dashboard/admin/settings-practice', icon: Sliders },
        { id: 'admin-settings-classroom', label: 'Classroom Settings', path: '/dashboard/admin/settings-classroom', icon: Radio },
        { id: 'admin-settings-payments', label: 'Payment Settings', path: '/dashboard/admin/settings-payments', icon: CreditCard },
        { id: 'admin-settings-commission', label: 'Commission Settings', path: '/dashboard/admin/settings-commission', icon: DollarSign },
        { id: 'admin-settings-roles', label: 'Role Permissions', path: '/dashboard/admin/settings-roles', icon: Shield }
      ]
    },
    {
      group: 'Audit Logs',
      items: [
        { id: 'admin-audit-logs', label: 'Admin Activity History', path: '/dashboard/admin/audit-logs', icon: History }
      ]
    }
  ]
};

export function getRoleNavigation(role = 'student') {
  return ROLE_NAVIGATION[role] || ROLE_NAVIGATION.student;
}
