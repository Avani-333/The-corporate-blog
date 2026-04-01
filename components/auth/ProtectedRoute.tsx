/**
 * Protected Route Component
 * Handles client-side route protection and authentication checks
 */

'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole, UserStatus } from '@/types';
import { Loader2, Shield, AlertTriangle } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Required roles (user must have at least one) */
  requiredRoles?: UserRole[];
  /** Excluded roles (user cannot have any) */
  excludedRoles?: UserRole[];
  /** Required minimum role level */
  minimumRole?: UserRole;
  /** Required user status */
  requiredStatus?: UserStatus[];
  /** Custom authorization function */
  customCheck?: (user: any) => boolean;
  /** Redirect URL for unauthorized access */
  unauthorizedRedirect?: string;
  /** Loading component */
  loadingComponent?: React.ReactNode;
  /** Fallback component for unauthorized users */
  fallbackComponent?: React.ReactNode;
  /** Allow access without authentication */
  allowUnauthenticated?: boolean;
}

// ============================================================================
// DEFAULT COMPONENTS
// ============================================================================

const DefaultLoadingComponent = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex items-center gap-3 text-gray-600">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <div className="text-lg font-medium">Authenticating...</div>
    </div>
  </div>
);

const DefaultUnauthorizedComponent = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center max-w-md">
      <div className="mx-auto h-16 w-16 text-red-500 mb-4">
        <Shield className="h-full w-full" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
      <p className="text-gray-600 mb-4">
        You don't have permission to access this page.
      </p>
      <button
        onClick={() => window.history.back()}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Go Back
      </button>
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProtectedRoute({
  children,
  requiredRoles,
  excludedRoles,
  minimumRole,
  requiredStatus = [UserStatus.ACTIVE],
  customCheck,
  unauthorizedRedirect,
  loadingComponent = <DefaultLoadingComponent />,
  fallbackComponent = <DefaultUnauthorizedComponent />,
  allowUnauthenticated = false,
}: ProtectedRouteProps) {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    isLoading,
    hasAnyRole,
    hasMinimumRole,
  } = useAuth();

  // ============================================================================
  // AUTHENTICATION CHECK
  // ============================================================================

  useEffect(() => {
    if (isLoading) return; // Wait for auth to initialize

    // Check if authentication is required
    if (!allowUnauthenticated && !isAuthenticated) {
      const redirectUrl = unauthorizedRedirect || '/auth/login';
      const loginUrl = new URL(redirectUrl, window.location.origin);
      loginUrl.searchParams.set('redirect', window.location.pathname);
      router.push(loginUrl.toString());
      return;
    }

    // If authentication not required and user not logged in, allow access
    if (allowUnauthenticated && !isAuthenticated) {
      return;
    }

    // All subsequent checks require an authenticated user
    if (!user) return;

    // Check user status
    if (!requiredStatus.includes(user.status)) {
      if (unauthorizedRedirect) {
        router.push(unauthorizedRedirect);
      }
      return;
    }

    // Check required roles
    if (requiredRoles && !hasAnyRole(requiredRoles)) {
      if (unauthorizedRedirect) {
        const redirectUrl = new URL(unauthorizedRedirect, window.location.origin);
        redirectUrl.searchParams.set('error', 'insufficient_permissions');
        router.push(redirectUrl.toString());
      }
      return;
    }

    // Check excluded roles
    if (excludedRoles && hasAnyRole(excludedRoles)) {
      if (unauthorizedRedirect) {
        const redirectUrl = new URL(unauthorizedRedirect, window.location.origin);
        redirectUrl.searchParams.set('error', 'insufficient_permissions');
        router.push(redirectUrl.toString());
      }
      return;
    }

    // Check minimum role
    if (minimumRole && !hasMinimumRole(minimumRole)) {
      if (unauthorizedRedirect) {
        const redirectUrl = new URL(unauthorizedRedirect, window.location.origin);
        redirectUrl.searchParams.set('error', 'insufficient_permissions');
        router.push(redirectUrl.toString());
      }
      return;
    }

    // Custom authorization check
    if (customCheck && !customCheck(user)) {
      if (unauthorizedRedirect) {
        const redirectUrl = new URL(unauthorizedRedirect, window.location.origin);
        redirectUrl.searchParams.set('error', 'custom_check_failed');
        router.push(redirectUrl.toString());
      }
      return;
    }
  }, [
    isLoading,
    isAuthenticated,
    user,
    requiredRoles,
    excludedRoles,
    minimumRole,
    requiredStatus,
    customCheck,
    unauthorizedRedirect,
    allowUnauthenticated,
    router,
    hasAnyRole,
    hasMinimumRole,
  ]);

  // ============================================================================
  // RENDER LOGIC
  // ============================================================================

  // Show loading while initializing
  if (isLoading) {
    return loadingComponent;
  }

  // Allow unauthenticated access if specified
  if (allowUnauthenticated && !isAuthenticated) {
    return <>{children}</>;
  }

  // Check if user is authenticated
  if (!isAuthenticated || !user) {
    return null; // Will redirect via useEffect
  }

  // Check user status
  if (!requiredStatus.includes(user.status)) {
    return fallbackComponent;
  }

  // Check required roles
  if (requiredRoles && !hasAnyRole(requiredRoles)) {
    return fallbackComponent;
  }

  // Check excluded roles
  if (excludedRoles && hasAnyRole(excludedRoles)) {
    return fallbackComponent;
  }

  // Check minimum role
  if (minimumRole && !hasMinimumRole(minimumRole)) {
    return fallbackComponent;
  }

  // Custom authorization check
  if (customCheck && !customCheck(user)) {
    return fallbackComponent;
  }

  // All checks passed - render children
  return <>{children}</>;
}

// ============================================================================
// CONVENIENT WRAPPERS
// ============================================================================

/**
 * Require authentication but no specific role
 */
export function RequireAuth({ children, ...props }: Omit<ProtectedRouteProps, 'allowUnauthenticated'>) {
  return (
    <ProtectedRoute allowUnauthenticated={false} {...props}>
      {children}
    </ProtectedRoute>
  );
}

/**
 * Require specific role
 */
export function RequireRole({ role, children, ...props }: { role: UserRole } & Omit<ProtectedRouteProps, 'requiredRoles'>) {
  return (
    <ProtectedRoute requiredRoles={[role]} {...props}>
      {children}
    </ProtectedRoute>
  );
}

/**
 * Admin only access
 */
export function AdminOnly({ children, ...props }: Omit<ProtectedRouteProps, 'requiredRoles'>) {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]} {...props}>
      {children}
    </ProtectedRoute>
  );
}

/**
 * Staff only access (editors and above)
 */
export function StaffOnly({ children, ...props }: Omit<ProtectedRouteProps, 'minimumRole'>) {
  return (
    <ProtectedRoute minimumRole={UserRole.EDITOR} {...props}>
      {children}
    </ProtectedRoute>
  );
}

/**
 * Content creators (authors and above)
 */
export function CreatorsOnly({ children, ...props }: Omit<ProtectedRouteProps, 'minimumRole'>) {
  return (
    <ProtectedRoute minimumRole={UserRole.AUTHOR} {...props}>
      {children}
    </ProtectedRoute>
  );
}