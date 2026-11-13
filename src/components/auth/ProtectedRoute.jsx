import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { LoadingScreen } from './LoadingScreen.jsx';
import { SuspendedAccountPage } from './SuspendedAccountPage.jsx';

/**
 * ProtectedRoute
 * Ensures a user is authenticated and their account is in good standing (not suspended/banned).
 */
export function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen message="Checking authentication & account status..." />;
  }

  if (!currentUser) {
    // Redirect unauthenticated user to login preserving location intent
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Account status verification
  const status = currentUser.status || 'active';
  if (status === 'suspended' || status === 'banned') {
    return <SuspendedAccountPage user={currentUser} />;
  }

  return children;
}
