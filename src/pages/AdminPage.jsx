import React, { useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import { AdminDashboard } from '../features/admin/AdminDashboard.jsx';

export function AdminPage() {
  const [activeTab, setActiveTab] = useState('admin-overview');

  // Sidebar item id -> AdminDashboard tab. Every sidebar id must land somewhere (never a blank page).
  const resolveAdminTab = (tab) => {
    const map = {
      'admin-overview': 'overview', 'admin-home': 'overview',
      'admin-users-all': 'users', 'admin-users-students': 'users:student',
      'admin-users-mentors': 'users:mentor', 'admin-users-admins': 'users:admin',
      'admin-users-status': 'users:status',
      'admin-mentors-pending': 'mentor-apps', 'admin-mentors-verified': 'users:mentor',
      'admin-mentors-mgmt': 'users:mentor',
      'admin-leaderboard': 'overview',
    };
    if (map[tab]) return map[tab];
    if (tab.startsWith('admin-classes') || tab.startsWith('admin-classrooms') || tab.startsWith('admin-courses') || tab.startsWith('admin-enrollments')) return 'classes';
    if (tab.startsWith('admin-payments') || tab.startsWith('admin-payouts')) return 'payouts';
    if (tab.startsWith('admin-settings')) return 'settings';
    if (tab === 'supabase-usage') return tab;
    if (['overview', 'approval', 'mentor-apps', 'users', 'classes', 'payouts', 'settings'].includes(tab)) return tab;
    return 'overview';
  };

  const getTabMetadata = () => {
    const t = resolveAdminTab(activeTab);
    const [base, sub] = t.split(':');
    if (base === 'users') {
      const names = { student: 'Students', mentor: 'Mentors', admin: 'Admins', status: 'Account Status' };
      return { title: names[sub] || 'All Users', subtitle: 'View, approve, suspend and change roles', breadcrumbs: ['Users', names[sub] || 'All'] };
    }
    const titles = {
      overview: ['Admin Command Center', 'Platform overview, metrics and moderation controls', 'Overview'],
      approval: ['Community Approvals', 'Approve learners for practice and classrooms', 'Approvals'],
      'mentor-apps': ['Mentor Applications', 'Review teacher credentials and approve instructors', 'Mentors'],
      classes: ['Classes & Live Classrooms', 'Monitor active video rooms and live sessions', 'Classes'],
      payouts: ['Payments & Mentor Payouts', 'Transactions and mentor disbursements', 'Finance'],
      settings: ['Platform Settings', 'Commissions, limits and timezone', 'Settings'],
      'supabase-usage': ['Supabase Usage', 'Database and API usage', 'Usage'],
    };
    const m = titles[base] || titles.overview;
    return { title: m[0], subtitle: m[1], breadcrumbs: [m[2]] };
  };

  const metadata = getTabMetadata();

  return (
    <DashboardLayout
      role="admin"
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      pageTitle={metadata.title}
      pageSubtitle={metadata.subtitle}
      breadcrumbs={metadata.breadcrumbs}
    >
      <AdminDashboard activeTabProp={resolveAdminTab(activeTab)} onTabChange={setActiveTab} />
    </DashboardLayout>
  );
}
