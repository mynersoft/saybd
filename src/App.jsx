import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { NotificationProvider } from './contexts/NotificationContext.jsx';
import { Navbar } from './components/common/Navbar.jsx';
import { Footer } from './components/common/Footer.jsx';
import { MobileBottomBar } from './components/common/MobileBottomBar.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { PracticePage } from './pages/PracticePage.jsx';
import { ClassroomsPage } from './pages/ClassroomsPage.jsx';
import { CoursesPage } from './pages/CoursesPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { LeaderboardPage } from './pages/LeaderboardPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';
import { MentorDashboardPage } from './pages/MentorDashboardPage.jsx';
import { StudentDashboardPage } from './pages/dashboard/StudentDashboardPage.jsx';
import { DashboardRedirect } from './pages/dashboard/DashboardRedirect.jsx';
import { SignupPage } from './pages/SignupPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx';
import { RoleGuard } from './components/auth/RoleGuard.jsx';

import { PracticeInvitePage } from './pages/PracticeInvitePage.jsx';

function MainLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-8">
        {children}
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Dedicated Full-Screen Unified Dashboards with ProtectedRoute & RoleGuard */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardRedirect />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard/student/*"
                element={
                  <ProtectedRoute>
                    <RoleGuard allowedRoles={['student', 'admin']}>
                      <StudentDashboardPage />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard/mentor/*"
                element={
                  <ProtectedRoute>
                    <RoleGuard allowedRoles={['mentor', 'admin']}>
                      <MentorDashboardPage />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard/admin/*"
                element={
                  <ProtectedRoute>
                    <RoleGuard allowedRoles={['admin']}>
                      <AdminPage />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />

              {/* Standard Marketing & Feature Views wrapped with MainLayout */}
              <Route
                path="/*"
                element={
                  <MainLayout>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route
                        path="/practice"
                        element={
                          <ProtectedRoute>
                            <PracticePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/practice/invite/:token" element={<PracticeInvitePage />} />
                      <Route path="/classes" element={<ClassroomsPage />} />
                      <Route path="/courses" element={<CoursesPage />} />
                      <Route path="/leaderboard" element={<LeaderboardPage />} />
                      <Route
                        path="/profile"
                        element={
                          <ProtectedRoute>
                            <ProfilePage />
                          </ProtectedRoute>
                        }
                      />
                      {/* Standalone legacy redirect mappings for /mentor and /admin */}
                      <Route
                        path="/mentor"
                        element={<Navigate to="/dashboard/mentor" replace />}
                      />
                      <Route
                        path="/admin"
                        element={<Navigate to="/dashboard/admin" replace />}
                      />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/signin" element={<Navigate to="/login" replace />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password" element={<ForgotPasswordPage />} />
                      <Route path="/signup" element={<SignupPage />} />
                      <Route path="/register" element={<Navigate to="/signup" replace />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </MainLayout>
                }
              />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
