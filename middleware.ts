/**
 * Next.js Middleware Configuration
 * Handles authentication, route protection, rate limiting, CORS, and security headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireRole, adminOnly, staffOnly } from '@/lib/auth/middleware';
import { UserRole } from '@/types';
import {
  applyRateLimit,
  attachRateLimitHeaders,
  getClientIP,
  API_RATE_LIMIT,
  AUTH_RATE_LIMIT,
  LOGIN_RATE_LIMIT,
  SEARCH_RATE_LIMIT,
  CMS_WRITE_RATE_LIMIT,
  GLOBAL_RATE_LIMIT,
} from '@/lib/security/rate-limit';
import {
  checkAuthThrottle,
  checkPublishThrottle,
  checkSearchThrottle,
  getClientIp,
} from '@/lib/security/ip-throttle';
import { applySecurityHeaders } from '@/lib/security/headers';
import { corsMiddleware, applyCors } from '@/lib/security/cors';

// ============================================================================
// ROUTE MATCHERS
// ============================================================================

const PROTECTED_ROUTES = [
  '/dashboard',
  '/admin',
  '/profile',
  '/settings',
  '/api/auth/logout',
  '/api/auth/refresh',
];

const ADMIN_ROUTES = [
  '/admin',
  '/dashboard/admin',
  '/api/admin',
];

const CONTRIBUTOR_ROUTES = [
  '/dashboard/author',
];

const STAFF_ROUTES = [
  '/dashboard/posts/create',
  '/dashboard/posts/edit',
  '/api/posts/create',
  '/api/posts/update',
];

const API_ROUTES = [
  '/api/auth',
  '/api/posts',
  '/api/users',
  '/api/admin',
];

/**
 * Routes that must never be indexed by search engines.
 * The middleware injects an X-Robots-Tag header for all matching paths.
 */
const NOINDEX_ROUTES = [
  '/dashboard',
  '/admin',
  '/auth',
  '/profile',
  '/settings',
  '/api',
];

// ============================================================================
// ROUTE MATCHING UTILITIES
// ============================================================================

function matchesPattern(pathname: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (pattern.endsWith('*')) {
      return pathname.startsWith(pattern.slice(0, -1));
    }
    return pathname === pattern || pathname.startsWith(pattern + '/');
  });
}

function isProtectedRoute(pathname: string): boolean {
  return matchesPattern(pathname, PROTECTED_ROUTES);
}

function isAdminRoute(pathname: string): boolean {
  return matchesPattern(pathname, ADMIN_ROUTES);
}

function isContributorRoute(pathname: string): boolean {
  return matchesPattern(pathname, CONTRIBUTOR_ROUTES);
}

function isStaffRoute(pathname: string): boolean {
  return matchesPattern(pathname, STAFF_ROUTES);
}

function isApiRoute(pathname: string): boolean {
  return matchesPattern(pathname, API_ROUTES);
}

function isPublicApiRoute(pathname: string): boolean {
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/google',
    '/api/health',
    '/api/posts/public',
  ];
  return matchesPattern(pathname, publicRoutes);
}

function isNoIndexRoute(pathname: string): boolean {
  return matchesPattern(pathname, NOINDEX_ROUTES);
}

/**
 * Attach X-Robots-Tag: noindex, nofollow, noarchive to a response
 */
function applyNoIndexHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

// ============================================================================
// RATE LIMIT ROUTE CONFIG
// ============================================================================

/**
 * Get rate limit config with IP-based throttling
 */
function getRateLimitConfig(pathname: string, method: string) {
  // Login endpoint — strictest limit
  if (pathname === '/api/auth/login') return LOGIN_RATE_LIMIT;
  // Auth endpoints (register, reset, refresh, google, etc.)
  if (pathname.startsWith('/api/auth/')) return AUTH_RATE_LIMIT;
  // Search
  if (pathname.startsWith('/api/search')) return SEARCH_RATE_LIMIT;
  // CMS write operations (publish)
  if (pathname.startsWith('/api/cms/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return CMS_WRITE_RATE_LIMIT;
  // General API
  if (pathname.startsWith('/api/')) return API_RATE_LIMIT;
  // Everything else
  return GLOBAL_RATE_LIMIT;
}

// ============================================================================
// MIDDLEWARE LOGIC
// ============================================================================

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const clientIp = getClientIp(request);

  // Skip middleware for static assets and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // ---------- IP-BASED THROTTLING FOR SENSITIVE ENDPOINTS ----------
  // Auth endpoints: login, register, refresh, password reset
  if (pathname.startsWith('/api/auth/')) {
    const throttle = checkAuthThrottle(clientIp);
    if (!throttle.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Too many authentication attempts from this IP. Please try again later.',
          retryAfter: throttle.retryAfter,
        },
        { status: 429 }
      );
      response.headers.set('Retry-After', String(throttle.retryAfter));
      applySecurityHeaders(response);
      return response;
    }
  }

  // Publish endpoints: create/update posts (CMS)
  if (pathname.startsWith('/api/cms/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const throttle = checkPublishThrottle(clientIp);
    if (!throttle.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Too many publish requests from this IP. Please try again later.',
          retryAfter: throttle.retryAfter,
        },
        { status: 429 }
      );
      response.headers.set('Retry-After', String(throttle.retryAfter));
      applySecurityHeaders(response);
      return response;
    }
  }

  // Search endpoint: full-text search
  if (pathname.startsWith('/api/search')) {
    const throttle = checkSearchThrottle(clientIp);
    if (!throttle.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Too many search requests from this IP. Please try again later.',
          retryAfter: throttle.retryAfter,
        },
        { status: 429 }
      );
      response.headers.set('Retry-After', String(throttle.retryAfter));
      applySecurityHeaders(response);
      return response;
    }
  }

  // ---------- CORS: handle preflight & origin check ----------
  if (pathname.startsWith('/api/')) {
    const corsResponse = corsMiddleware(request);
    if (corsResponse) {
      applySecurityHeaders(corsResponse);
      return corsResponse;
    }
  }

  // ---------- Rate Limiting ----------
  const rateLimitConfig = getRateLimitConfig(pathname, request.method);
  const rateLimitResponse = applyRateLimit(request, rateLimitConfig);
  if (rateLimitResponse) {
    applySecurityHeaders(rateLimitResponse);
    return rateLimitResponse;
  }

  // Determine if this route should be blocked from indexing
  const shouldNoIndex = isNoIndexRoute(pathname);

  // Allow public API routes without authentication
  if (isPublicApiRoute(pathname)) {
    const response = NextResponse.next();
    if (shouldNoIndex) applyNoIndexHeaders(response);
    applySecurityHeaders(response);
    if (pathname.startsWith('/api/')) applyCors(response, request);
    return response;
  }

  // Handle admin routes
  if (isAdminRoute(pathname)) {
    const response = await adminOnly({
      unauthorizedRedirect: '/auth/login?error=insufficient_permissions',
    })(request);
    if (shouldNoIndex) applyNoIndexHeaders(response);
    applySecurityHeaders(response);
    return response;
  }

  // Handle contributor+ routes
  if (isContributorRoute(pathname)) {
    const response = await withAuth({
      requiredRoles: [
        UserRole.CONTRIBUTOR,
        UserRole.AUTHOR,
        UserRole.EDITOR,
        UserRole.MODERATOR,
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
      ],
      unauthorizedRedirect: '/auth/login?error=insufficient_permissions',
    })(request);
    if (shouldNoIndex) applyNoIndexHeaders(response);
    applySecurityHeaders(response);
    return response;
  }

  // Handle staff routes (content creation/editing)
  if (isStaffRoute(pathname)) {
    const response = await staffOnly({
      unauthorizedRedirect: '/auth/login?error=insufficient_permissions',
    })(request);
    if (shouldNoIndex) applyNoIndexHeaders(response);
    applySecurityHeaders(response);
    return response;
  }

  // Handle general protected routes
  if (isProtectedRoute(pathname)) {
    const response = await withAuth({
      requiredRoles: [UserRole.SUBSCRIBER],
      unauthorizedRedirect: '/auth/login',
      skipIf: (req) => {
        return req.nextUrl.pathname === '/api/auth/logout';
      },
    })(request);
    if (shouldNoIndex) applyNoIndexHeaders(response);
    applySecurityHeaders(response);
    return response;
  }

  // Handle API routes with specific requirements
  if (isApiRoute(pathname)) {
    let response: NextResponse;

    // Admin API routes
    if (pathname.startsWith('/api/admin/')) {
      response = await adminOnly()(request);
    }
    // Content management API routes
    else if (
      pathname.startsWith('/api/posts/') && 
      !pathname.includes('/public') &&
      request.method !== 'GET'
    ) {
      response = await staffOnly()(request);
    }
    // User management API routes
    else if (pathname.startsWith('/api/users/')) {
      response = await withAuth({
        requiredRoles: [UserRole.SUBSCRIBER],
        customCheck: async (user, req) => {
          // Users can access their own profile
          if (req.nextUrl.pathname.includes(`/api/users/${user.id}`)) {
            return true;
          }
          // Only staff+ can access other users
          return [UserRole.MODERATOR, UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role);
        },
      })(request);
    }
    // Other protected API routes
    else if (pathname.startsWith('/api/') && !isPublicApiRoute(pathname)) {
      response = await withAuth({
        allowUnauthenticated: false,
      })(request);
    } else {
      response = NextResponse.next();
    }

    if (shouldNoIndex) applyNoIndexHeaders(response!);
    applySecurityHeaders(response!);
    applyCors(response!, request);
    attachRateLimitHeaders(response!, request, rateLimitConfig);
    return response!;
  }

  // Allow all other routes (public pages)
  const response = NextResponse.next();
  if (shouldNoIndex) applyNoIndexHeaders(response);

  // ---------- Apply security headers & CORS to every response ----------
  applySecurityHeaders(response);
  if (pathname.startsWith('/api/')) {
    applyCors(response, request);
    attachRateLimitHeaders(response, request, rateLimitConfig);
  }

  return response;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|static).*)',
  ],
};

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default middleware;