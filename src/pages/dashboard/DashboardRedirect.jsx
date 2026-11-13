import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { LoadingScreen } from '../../components/auth/LoadingScreen.jsx';

/**
 * DashboardRedirect
 * Inspects authenticated user role and immediately routes to their respective role dashboard.
 */
export function DashboardRedirect() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Redirecting to your dashboard..." />;
  }

  if (!currentUser) {
    return <Navigate to="/signup" replace />;
  }

  const role = currentUser.role || 'student';
  if (role === 'admin') {
    return <Navigate to="/dashboard/admin" replace />;
  }
  if (role === 'mentor') {
    return <Navigate to="/dashboard/mentor" replace />;
  }
  return <Navigate to="/dashboard/student" replace />;
}
