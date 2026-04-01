/**
 * CORS Policy Configuration
 *
 * Defines allowed origins, methods, and headers for API routes.
 * Used in both next.config.js (static headers) and middleware (dynamic checks).
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// TYPES
// ============================================================================

export interface CorsOptions {
  /** Allowed origins. Use '*' for open, or list specific origins. */
  allowedOrigins: string[];
  /** Allowed HTTP methods. Default: GET, POST, PUT, DELETE, PATCH, OPTIONS */
  allowedMethods?: string[];
  /** Allowed request headers. */
  allowedHeaders?: string[];
  /** Headers to expose to the client. */
  exposedHeaders?: string[];
  /** Allow cookies / Authorization header. Default: true */
  credentials?: boolean;
  /** Preflight cache duration in seconds. Default: 86400 (24h) */
  maxAge?: number;
  /** Allow requests with no Origin header (e.g. same-origin, curl). Default: true */
  allowNoOrigin?: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const PRODUCTION_ORIGINS = [
  'https://thecorporateblog.com',
  'https://www.thecorporateblog.com',
  'https://admin.thecorporateblog.com',
];

const STAGING_ORIGINS = [
  'https://staging.thecorporateblog.com',
  'https://preview.thecorporateblog.com',
];

const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
];

function getDefaultOrigins(): string[] {
  const env = process.env.NODE_ENV;
  const extraOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];

  if (env === 'production') {
    return [...PRODUCTION_ORIGINS, ...extraOrigins];
  }
  if (env === 'test' || env === 'development') {
    return [...PRODUCTION_ORIGINS, ...STAGING_ORIGINS, ...DEVELOPMENT_ORIGINS, ...extraOrigins];
  }
  return [...PRODUCTION_ORIGINS, ...STAGING_ORIGINS, ...DEVELOPMENT_ORIGINS, ...extraOrigins];
}

export function getDefaultCorsOptions(): CorsOptions {
  return {
    allowedOrigins: getDefaultOrigins(),
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-CSRF-Token',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
      'X-Request-Id',
    ],
    credentials: true,
    maxAge: 86400,
    allowNoOrigin: true,
  };
}

// ============================================================================
// ORIGIN VALIDATION
// ============================================================================

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  // Exact match
  if (allowedOrigins.includes(origin)) return true;

  // Wildcard match
  if (allowedOrigins.includes('*')) return true;

  // Pattern match (e.g. *.thecorporateblog.com)
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      try {
        const url = new URL(origin);
        if (url.hostname === domain || url.hostname.endsWith(`.${domain}`)) {
          return true;
        }
      } catch { /* invalid URL, skip */ }
    }
  }

  // Vercel preview deployment pattern
  if (process.env.VERCEL === '1') {
    try {
      const url = new URL(origin);
      if (url.hostname.endsWith('.vercel.app')) return true;
    } catch { /* skip */ }
  }

  return false;
}

// ============================================================================
// CORS HEADERS
// ============================================================================

function setCorsHeaders(
  headers: Headers,
  origin: string | null,
  options: CorsOptions
): void {
  const {
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization'],
    exposedHeaders = [],
    credentials = true,
    maxAge = 86400,
  } = options;

  // Access-Control-Allow-Origin
  if (origin && isOriginAllowed(origin, options.allowedOrigins)) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else if (options.allowedOrigins.includes('*') && !credentials) {
    headers.set('Access-Control-Allow-Origin', '*');
  }
  // Omit the header entirely if origin is not allowed → browser blocks the response

  // Vary on Origin so caches don't mix up responses for different origins
  headers.append('Vary', 'Origin');

  // Access-Control-Allow-Credentials
  if (credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // Access-Control-Allow-Methods
  headers.set('Access-Control-Allow-Methods', allowedMethods.join(', '));

  // Access-Control-Allow-Headers
  headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '));

  // Access-Control-Expose-Headers
  if (exposedHeaders.length > 0) {
    headers.set('Access-Control-Expose-Headers', exposedHeaders.join(', '));
  }

  // Access-Control-Max-Age (preflight cache)
  headers.set('Access-Control-Max-Age', String(maxAge));
}

// ============================================================================
// PREFLIGHT HANDLER
// ============================================================================

/**
 * Handle CORS preflight (OPTIONS) requests.
 * Returns a 204 response with CORS headers, or null if not a preflight.
 */
export function handlePreflight(
  request: NextRequest,
  options?: CorsOptions
): NextResponse | null {
  if (request.method !== 'OPTIONS') return null;

  const corsOptions = options || getDefaultCorsOptions();
  const origin = request.headers.get('origin');

  // Check if this is actually a CORS preflight
  const accessControlRequestMethod = request.headers.get('access-control-request-method');
  if (!accessControlRequestMethod) return null;

  const response = new NextResponse(null, { status: 204 });
  setCorsHeaders(response.headers, origin, corsOptions);

  return response;
}

// ============================================================================
// MIDDLEWARE INTEGRATION
// ============================================================================

/**
 * Apply CORS headers to an existing response in middleware.
 */
export function applyCors(
  response: NextResponse,
  request: NextRequest,
  options?: CorsOptions
): NextResponse {
  const corsOptions = options || getDefaultCorsOptions();
  const origin = request.headers.get('origin');

  // Only apply to API routes by default
  setCorsHeaders(response.headers, origin, corsOptions);

  return response;
}

/**
 * Full CORS middleware check. Returns a preflight response if needed,
 * or null to continue processing.
 */
export function corsMiddleware(
  request: NextRequest,
  options?: CorsOptions
): NextResponse | null {
  // Handle preflight
  const preflightResponse = handlePreflight(request, options);
  if (preflightResponse) return preflightResponse;

  // For non-preflight, check if the origin is allowed
  const corsOptions = options || getDefaultCorsOptions();
  const origin = request.headers.get('origin');

  if (origin && !isOriginAllowed(origin, corsOptions.allowedOrigins)) {
    if (!corsOptions.allowNoOrigin) {
      return NextResponse.json(
        { success: false, error: 'CORS: Origin not allowed' },
        { status: 403 }
      );
    }
  }

  return null; // Allowed – continue processing
}

// ============================================================================
// ROUTE HANDLER WRAPPER
// ============================================================================

/**
 * HOF to wrap a Next.js API route handler with CORS support.
 *
 * Usage:
 *   export const GET = withCors(handler);
 *   export const OPTIONS = withCors(handler);
 */
export function withCors(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse,
  options?: CorsOptions
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const corsOptions = options || getDefaultCorsOptions();

    // Handle preflight
    if (request.method === 'OPTIONS') {
      const preflightResponse = handlePreflight(request, corsOptions);
      if (preflightResponse) return preflightResponse;
    }

    const response = await handler(request, context);
    const origin = request.headers.get('origin');
    setCorsHeaders(response.headers, origin, corsOptions);

    return response;
  };
}

// ============================================================================
// NEXT.JS CONFIG HELPER
// ============================================================================

/**
 * Generate static CORS headers for next.config.js.
 * For dynamic origin checking, use the middleware approach instead.
 */
export function getStaticCorsHeaders(): { key: string; value: string }[] {
  const isProd = process.env.NODE_ENV === 'production';
  const origin = isProd
    ? 'https://thecorporateblog.com'
    : 'http://localhost:3000';

  return [
    { key: 'Access-Control-Allow-Origin', value: origin },
    { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS' },
    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token' },
    { key: 'Access-Control-Allow-Credentials', value: 'true' },
    { key: 'Access-Control-Max-Age', value: '86400' },
    { key: 'Access-Control-Expose-Headers', value: 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After' },
    { key: 'Vary', value: 'Origin' },
  ];
}
