/**
 * Role Guard Component
 * Conditionally renders UI based on user roles and permissions
 */

'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

interface RoleGuardProps {
  children: React.ReactNode;
  /** Required roles (user must have at least one) */
  roles?: UserRole[];
  /** Excluded roles (user cannot have any) */
  excludedRoles?: UserRole[];
  /** Required minimum role level */
  minimumRole?: UserRole;
  /** Required permissions */
  permissions?: Array<{ resource: string; action: string }>;
  /** Custom authorization function */
  customCheck?: (user: any) => boolean;
  /** Fallback content for unauthorized users */
  fallback?: React.ReactNode;
  /** Invert the logic (show only when NOT authorized) */
  invert?: boolean;
  /** Require authentication */
  requireAuth?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RoleGuard({
  children,
  roles,
  excludedRoles,
  minimumRole,
  permissions,
  customCheck,
  fallback = null,
  invert = false,
  requireAuth = true,
}: RoleGuardProps) {
  const {
    user,
    isAuthenticated,
    hasAnyRole,
    hasMinimumRole,
    canAccess,
  } = useAuth();

  // ============================================================================
  // AUTHORIZATION LOGIC
  // ============================================================================

  const isAuthorized = (): boolean => {
    // Check authentication requirement
    if (requireAuth && !isAuthenticated) {
      return false;
    }

    // If no user and auth not required, allow access
    if (!user && !requireAuth) {
      return true;
    }

    // If user required but not present, deny access
    if (!user) {
      return false;
    }

    // Check required roles
    if (roles && !hasAnyRole(roles)) {
      return false;
    }

    // Check excluded roles
    if (excludedRoles && hasAnyRole(excludedRoles)) {
      return false;
    }

    // Check minimum role
    if (minimumRole && !hasMinimumRole(minimumRole)) {
      return false;
    }

    // Check permissions
    if (permissions) {
      const hasAllPermissions = permissions.every(({ resource, action }) =>
        canAccess(resource, action)
      );
      if (!hasAllPermissions) {
        return false;
      }
    }

    // Custom authorization check
    if (customCheck && !customCheck(user)) {
      return false;
    }

    return true;
  };

  // ============================================================================
  // RENDER LOGIC
  // ============================================================================

  const authorized = isAuthorized();
  const shouldRender = invert ? !authorized : authorized;

  return shouldRender ? <>{children}</> : <>{fallback}</>;
}

// ============================================================================
// CONVENIENT WRAPPERS
// ============================================================================

/**
 * Show content only to specific role
 */
export function ShowForRole({ role, children, fallback }: { role: UserRole; children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGuard roles={[role]} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/**
 * Show content only to admin users
 */
export function ShowForAdmin({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGuard roles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/**
 * Show content only to staff (editor and above)
 */
export function ShowForStaff({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGuard minimumRole={UserRole.EDITOR} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/**
 * Show content only to content creators (author and above)
 */
export function ShowForCreators({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGuard minimumRole={UserRole.AUTHOR} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/**
 * Show content only to authenticated users
 */
export function ShowForAuthenticated({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGuard requireAuth={true} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/**
 * Show content only to unauthenticated users
 */
export function ShowForGuests({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGuard requireAuth={true} invert={true} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/**
 * Show content based on specific permissions
 */
export function ShowForPermissions({
  permissions,
  children,
  fallback,
}: {
  permissions: Array<{ resource: string; action: string }>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <RoleGuard permissions={permissions} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}