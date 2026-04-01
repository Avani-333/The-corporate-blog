/**
 * Authentication and Role-Based Access Control Middleware
 * Protects routes based on authentication and user roles
 */

import { NextRequest, NextResponse } from 'next/server';
import type { NextMiddleware } from 'next/server';
import { 
  verifyAccessToken, 
  getAccessToken, 
  validateUserStatus,
  AUTH_ERRORS,
  type JWTUser 
} from './jwt';
import { UserRole, UserStatus } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthMiddlewareOptions {
  /** Required roles (user must have at least one) */
  requiredRoles?: UserRole[];
  /** Excluded roles (user cannot have any) */
  excludedRoles?: UserRole[];
  /** Allow access without authentication */
  allowUnauthenticated?: boolean;
  /** Redirect URL for unauthorized access */
  unauthorizedRedirect?: string;
  /** Required user status */
  requiredStatus?: UserStatus[];
  /** Custom authorization function */
  customCheck?: (user: JWTUser, request: NextRequest) => boolean | Promise<boolean>;
  /** Skip middleware for specific conditions */
  skipIf?: (request: NextRequest) => boolean;
}

export interface AuthContext {
  user: JWTUser | null;
  isAuthenticated: boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasAllRoles: (roles: UserRole[]) => boolean;
  canAccess: (resource: string, action: string) => boolean;
}

// ============================================================================
// ROLE HIERARCHY AND PERMISSIONS
// ============================================================================

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 1000,
  [UserRole.ADMIN]: 800,
  [UserRole.MODERATOR]: 600,
  [UserRole.EDITOR]: 400,
  [UserRole.AUTHOR]: 300,
  [UserRole.CONTRIBUTOR]: 200,
  [UserRole.SUBSCRIBER]: 100,
  [UserRole.GUEST]: 50,
};

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.SUPER_ADMIN]: [
    'system:*',
    'user:*',
    'content:*',
    'analytics:*',
    'settings:*',
  ],
  [UserRole.ADMIN]: [
    'user:manage',
    'user:view',
    'content:*',
    'analytics:view',
    'settings:manage',
  ],
  [UserRole.MODERATOR]: [
    'user:view',
    'content:moderate',
    'content:edit',
    'content:view',
    'analytics:view',
  ],
  [UserRole.EDITOR]: [
    'content:edit',
    'content:create',
    'content:view',
    'content:publish',
  ],
  [UserRole.AUTHOR]: [
    'content:create',
    'content:edit:own',
    'content:view',
  ],
  [UserRole.CONTRIBUTOR]: [
    'content:create',
    'content:edit:own',
    'content:view:own',
  ],
  [UserRole.SUBSCRIBER]: [
    'content:view:public',
    'profile:edit:own',
  ],
  [UserRole.GUEST]: [
    'content:view:public',
  ],
};

// ============================================================================
// ROLE CHECKING UTILITIES
// ============================================================================

/**
 * Check if user has specific role
 */
export function hasRole(user: JWTUser | null, role: UserRole): boolean {
  if (!user) return false;
  return user.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user: JWTUser | null, roles: UserRole[]): boolean {
  if (!user || !roles.length) return false;
  return roles.includes(user.role);
}

/**
 * Check if user has all specified roles (for multi-role scenarios)
 */
export function hasAllRoles(user: JWTUser | null, roles: UserRole[]): boolean {
  if (!user || !roles.length) return false;
  // Since we have single-role system, user needs to have sufficient role level
  const userLevel = ROLE_HIERARCHY[user.role] || 0;
  const requiredLevel = Math.max(...roles.map(role => ROLE_HIERARCHY[role] || 0));
  return userLevel >= requiredLevel;
}

/**
 * Check if user role is higher in hierarchy
 */
export function hasHigherRole(user: JWTUser | null, role: UserRole): boolean {
  if (!user) return false;
  const userLevel = ROLE_HIERARCHY[user.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[role] || 0;
  return userLevel > requiredLevel;
}

/**
 * Check if user role is at least the specified role level
 */
export function hasMinimumRole(user: JWTUser | null, minimumRole: UserRole): boolean {
  if (!user) return false;
  const userLevel = ROLE_HIERARCHY[user.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Check if user has specific permission
 */
export function hasPermission(user: JWTUser | null, resource: string, action: string): boolean {
  if (!user) return false;
  
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  const fullPermission = `${resource}:${action}`;
  
  // Check for exact permission match
  if (permissions.includes(fullPermission)) return true;
  
  // Check for wildcard permissions
  if (permissions.includes(`${resource}:*`)) return true;
  if (permissions.includes('*')) return true;
  
  // Check for system-wide permissions
  if (permissions.includes('system:*')) return true;
  
  return false;
}

/**
 * Get all permissions for user role
 */
export function getUserPermissions(user: JWTUser | null): string[] {
  if (!user) return [];
  return ROLE_PERMISSIONS[user.role] || [];
}

// ============================================================================
// AUTHENTICATION CONTEXT
// ============================================================================

/**
 * Create authentication context from user
 */
export function createAuthContext(user: JWTUser | null): AuthContext {
  return {
    user,
    isAuthenticated: !!user,
    hasRole: (role: UserRole | UserRole[]) => {
      if (Array.isArray(role)) {
        return hasAnyRole(user, role);
      }
      return hasRole(user, role);
    },
    hasAnyRole: (roles: UserRole[]) => hasAnyRole(user, roles),
    hasAllRoles: (roles: UserRole[]) => hasAllRoles(user, roles),
    canAccess: (resource: string, action: string) => hasPermission(user, resource, action),
  };
}

// ============================================================================
// MIDDLEWARE FUNCTIONS
// ============================================================================

/**
 * Extract and verify user from request
 */
export async function extractUser(request: NextRequest): Promise<JWTUser | null> {
  try {
    const token = getAccessToken(request);
    if (!token) return null;

    const user = await verifyAccessToken(token);
    if (!user) return null;

    // Validate user status
    const statusValidation = validateUserStatus(user.status);
    if (!statusValidation.valid) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error extracting user from request:', error);
    return null;
  }
}

/**
 * Check if request should be skipped by middleware
 */
function shouldSkipMiddleware(request: NextRequest, options?: AuthMiddlewareOptions): boolean {
  // Skip if custom skip function returns true
  if (options?.skipIf && options.skipIf(request)) {
    return true;
  }

  // Skip for static assets
  if (request.nextUrl.pathname.startsWith('/_next/')) {
    return true;
  }

  // Skip for health checks
  if (request.nextUrl.pathname === '/api/health') {
    return true;
  }

  return false;
}

/**
 * Create authorization response
 */
function createUnauthorizedResponse(
  request: NextRequest, 
  options?: AuthMiddlewareOptions, 
  error?: string
): NextResponse {
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  
  if (isApiRoute) {
    return NextResponse.json(
      { error: error || AUTH_ERRORS.INSUFFICIENT_PERMISSIONS },
      { status: 401 }
    );
  }

  // Redirect to login page or specified redirect
  const redirectUrl = options?.unauthorizedRedirect || '/auth/login';
  const loginUrl = new URL(redirectUrl, request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  
  return NextResponse.redirect(loginUrl);
}

/**
 * Main authentication middleware
 */
export function withAuth(options: AuthMiddlewareOptions = {}): NextMiddleware {
  return async function middleware(request: NextRequest): Promise<NextResponse> {
    try {
      // Skip middleware if conditions are met
      if (shouldSkipMiddleware(request, options)) {
        return NextResponse.next();
      }

      // Extract user from request
      const user = await extractUser(request);

      // Handle unauthenticated requests
      if (!user) {
        if (options.allowUnauthenticated) {
          return NextResponse.next();
        }
        return createUnauthorizedResponse(request, options, AUTH_ERRORS.TOKEN_INVALID);
      }

      // Check required status
      if (options.requiredStatus && !options.requiredStatus.includes(user.status)) {
        return createUnauthorizedResponse(
          request, 
          options, 
          'Account status does not allow access'
        );
      }

      // Check required roles
      if (options.requiredRoles && !hasAnyRole(user, options.requiredRoles)) {
        return createUnauthorizedResponse(request, options, AUTH_ERRORS.INSUFFICIENT_PERMISSIONS);
      }

      // Check excluded roles
      if (options.excludedRoles && hasAnyRole(user, options.excludedRoles)) {
        return createUnauthorizedResponse(request, options, AUTH_ERRORS.INSUFFICIENT_PERMISSIONS);
      }

      // Custom authorization check
      if (options.customCheck) {
        const customResult = await options.customCheck(user, request);
        if (!customResult) {
          return createUnauthorizedResponse(request, options, AUTH_ERRORS.INSUFFICIENT_PERMISSIONS);
        }
      }

      // Add user to request headers for downstream use
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', user.id);
      requestHeaders.set('x-user-email', user.email);
      requestHeaders.set('x-user-role', user.role);
      requestHeaders.set('x-user-status', user.status);

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (error) {
      console.error('Auth middleware error:', error);
      return createUnauthorizedResponse(request, options, AUTH_ERRORS.INTERNAL_ERROR);
    }
  };
}

// ============================================================================
// HIGHER-ORDER FUNCTIONS FOR COMMON USE CASES
// ============================================================================

/**
 * Require authentication
 */
export const requireAuth = (options: Omit<AuthMiddlewareOptions, 'allowUnauthenticated'> = {}) =>
  withAuth({ ...options, allowUnauthenticated: false });

/**
 * Require specific role
 */
export const requireRole = (role: UserRole, options: AuthMiddlewareOptions = {}) =>
  withAuth({ ...options, requiredRoles: [role] });

/**
 * Require any of the specified roles
 */
export const requireAnyRole = (roles: UserRole[], options: AuthMiddlewareOptions = {}) =>
  withAuth({ ...options, requiredRoles: roles });

/**
 * Require minimum role level
 */
export const requireMinRole = (minimumRole: UserRole, options: AuthMiddlewareOptions = {}) =>
  withAuth({
    ...options,
    customCheck: (user) => hasMinimumRole(user, minimumRole),
  });

/**
 * Admin only access
 */
export const adminOnly = (options: AuthMiddlewareOptions = {}) =>
  requireAnyRole([UserRole.ADMIN, UserRole.SUPER_ADMIN], options);

/**
 * Staff only access (editors and above)
 */
export const staffOnly = (options: AuthMiddlewareOptions = {}) =>
  requireMinRole(UserRole.EDITOR, options);

/**
 * Content creators (authors and above)
 */
export const creatorsOnly = (options: AuthMiddlewareOptions = {}) =>
  requireMinRole(UserRole.AUTHOR, options);

// ============================================================================
// UTILITY MIDDLEWARE FOR API ROUTES
// ============================================================================

/**
 * API route authentication wrapper
 */
export function withApiAuth(
  handler: (request: NextRequest, context: { user: JWTUser }) => Promise<NextResponse>,
  options: AuthMiddlewareOptions = {}
) {
  return async function(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await extractUser(request);
      
      if (!user) {
        return NextResponse.json(
          { error: AUTH_ERRORS.TOKEN_INVALID },
          { status: 401 }
        );
      }

      // Apply same checks as regular middleware
      if (options.requiredRoles && !hasAnyRole(user, options.requiredRoles)) {
        return NextResponse.json(
          { error: AUTH_ERRORS.INSUFFICIENT_PERMISSIONS },
          { status: 403 }
        );
      }

      if (options.excludedRoles && hasAnyRole(user, options.excludedRoles)) {
        return NextResponse.json(
          { error: AUTH_ERRORS.INSUFFICIENT_PERMISSIONS },
          { status: 403 }
        );
      }

      if (options.customCheck) {
        const customResult = await options.customCheck(user, request);
        if (!customResult) {
          return NextResponse.json(
            { error: AUTH_ERRORS.INSUFFICIENT_PERMISSIONS },
            { status: 403 }
          );
        }
      }

      return handler(request, { user });
    } catch (error) {
      console.error('API auth wrapper error:', error);
      return NextResponse.json(
        { error: AUTH_ERRORS.INTERNAL_ERROR },
        { status: 500 }
      );
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  withAuth,
  requireAuth,
  requireRole,
  requireAnyRole,
  requireMinRole,
  adminOnly,
  staffOnly,
  creatorsOnly,
  withApiAuth,
  extractUser,
  createAuthContext,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  hasPermission,
  getUserPermissions,
};