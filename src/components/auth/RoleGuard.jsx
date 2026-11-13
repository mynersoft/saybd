import React from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { UnauthorizedPage } from './UnauthorizedPage.jsx';

/**
 * RoleGuard
 * Enforces server-compatible role access control.
 * @param {Array<string>} allowedRoles - e.g. ['student', 'mentor', 'admin']
 * @param {React.ReactNode} children - rendered when authorized
 */
export function RoleGuard({ allowedRoles = [], children }) {
  const { currentUser } = useAuth();
  const currentRole = currentUser?.role || 'student';

  if (!allowedRoles.includes(currentRole)) {
    return <UnauthorizedPage requiredRole={allowedRoles[0]} userRole={currentRole} />;
  }

  return children;
}
