import React, { useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import { AdminDashboard } from '../features/admin/AdminDashboard.jsx';

export function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const getTabMetadata = () => {
    switch (activeTab) {
      case 'overview':
        return { title: 'Admin Command Center', subtitle: 'Platform overview, metrics and moderation controls', breadcrumbs: ['Overview'] };
      case 'users':
      case 'all-users':
      case 'students-list':
      case 'suspended-users':
        return { title: 'User Management & Roles', subtitle: 'Directory, verification statuses, and role adjustments', breadcrumbs: ['Users'] };
      case 'approval':
      case 'pending-mentors':
      case 'approved-mentors':
        return { title: 'Mentor Application Approvals', subtitle: 'Review teacher credentials and approve instructor accounts', breadcrumbs: ['Mentors'] };
      case 'classes':
      case 'all-classes':
      case 'classrooms':
        return { title: 'Classes & Live Classrooms', subtitle: 'Monitor active video rooms and live sessions', breadcrumbs: ['Classes'] };
      case 'courses':
      case 'all-courses':
      case 'pending-courses':
        return { title: 'Course Content & Approvals', subtitle: 'Inspect mentor course curriculums and verify content', breadcrumbs: ['Courses'] };
      case 'payouts':
      case 'earnings':
      case 'pending-withdrawals':
      case 'platform-revenue':
        return { title: 'Payments & Mentor Payouts', subtitle: 'SSLCOMMERZ gross transactions and bKash / bank disbursements', breadcrumbs: ['Finance'] };
      case 'moderation':
      case 'user-reports':
        return { title: 'Safety & Moderation Reports', subtitle: 'Review flagged participants and enforce community rules', breadcrumbs: ['Moderation'] };
      case 'settings':
      case 'general-settings':
      case 'financial-settings':
        return { title: 'Platform Global Configuration', subtitle: 'Platform commissions, minimum payout and timezone', breadcrumbs: ['Settings'] };
      case 'audit-logs':
        return { title: 'System Security Audit Logs', subtitle: 'Immutable trace of administrative actions', breadcrumbs: ['Audit'] };
      default:
        return { title: 'Admin Dashboard', subtitle: '', breadcrumbs: [] };
    }
  };

  const metadata = getTabMetadata();

  // Normalize subkeys for AdminDashboard tabs
  const resolveAdminTab = (tab) => {
    if (tab === 'all-users' || tab === 'students-list' || tab === 'suspended-users') return 'users';
    if (tab === 'pending-mentors' || tab === 'approved-mentors') return 'approval';
    if (tab === 'all-classes' || tab === 'classrooms') return 'classes';
    if (tab === 'all-courses' || tab === 'pending-courses') return 'classes'; // or overview
    if (tab === 'pending-withdrawals' || tab === 'platform-revenue' || tab === 'earnings') return 'payouts';
    if (tab === 'general-settings' || tab === 'financial-settings') return 'settings';
    return tab;
  };

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
