import React, { useState } from 'react';
import { DashboardSidebar } from './DashboardSidebar.jsx';
import { DashboardTopbar } from './DashboardTopbar.jsx';
import { DashboardContent } from './DashboardContent.jsx';
import { MobileSidebarDrawer } from './MobileSidebarDrawer.jsx';
import { ROLE_NAVIGATION } from '../config/roleBasedNavigation.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export function DashboardLayout({
  role = 'student',
  activeTab = 'overview',
  onSelectTab,
  pageTitle = 'Dashboard',
  pageSubtitle = '',
  breadcrumbs = [],
  extraTopbarAction = null,
  children
}) {
  const { currentUser } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Pick navigation definition based on verified role
  const navigationGroups = ROLE_NAVIGATION[role] || ROLE_NAVIGATION.student;

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <DashboardSidebar
          navigationGroups={navigationGroups}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          role={role}
        />

        {/* Mobile Sidebar Drawer */}
        <MobileSidebarDrawer
          isOpen={isMobileDrawerOpen}
          onClose={() => setIsMobileDrawerOpen(false)}
          navigationGroups={navigationGroups}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          role={role}
        />

        {/* Main View Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <DashboardTopbar
            title={pageTitle}
            subtitle={pageSubtitle}
            breadcrumbs={breadcrumbs}
            onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
            onNavigateTab={onSelectTab}
            role={role}
            extraAction={extraTopbarAction}
          />

          <DashboardContent>
            {children}
          </DashboardContent>
        </div>
      </div>
    </div>
  );
}
