/**
 * Rate Limiter for Next.js API Routes
 * 
 * In-memory sliding-window rate limiter with per-route configuration.
 * For multi-instance deployments, swap the MemoryStore for a Redis adapter.
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  /** Maximum number of requests in the time window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Unique identifier for this limiter (e.g. 'api', 'auth') */
  name: string;
  /** Optional: Use a custom key function instead of IP */
  keyFn?: (request: NextRequest) => string;
  /** Optional: Skip rate limiting for certain requests */
  skipIf?: (request: NextRequest) => boolean;
  /** Optional: Custom message on limit exceeded */
  message?: string;
}

interface SlidingWindowEntry {
  timestamps: number[];
  blockedUntil?: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;       // Unix timestamp (seconds)
  retryAfter?: number;   // Seconds until next allowed request
}

// ============================================================================
// IN-MEMORY STORE
// ============================================================================

class MemoryStore {
  private store = new Map<string, SlidingWindowEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodic cleanup every 60 seconds to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  get(key: string): SlidingWindowEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: SlidingWindowEntry): void {
    this.store.set(key, entry);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  /** Remove expired entries */
  private cleanup(): void {
    const now = Date.now();
    // Keep a generous 5-minute look-back
    const maxAge = 5 * 60 * 1000;

    for (const [key, entry] of this.store) {
      const newest = entry.timestamps.length
        ? Math.max(...entry.timestamps)
        : 0;
      if (now - newest > maxAge && (!entry.blockedUntil || entry.blockedUntil < now)) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Singleton store (shared across all limiters within a process)
const store = new MemoryStore();

// ============================================================================
// CLIENT IDENTIFICATION
// ============================================================================

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfIp = request.headers.get('cf-connecting-ip'); // Cloudflare
  return cfIp || forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
}

// ============================================================================
// SLIDING WINDOW RATE LIMITER
// ============================================================================

function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const windowStart = now - windowMs;

  let entry = store.get(key);

  if (!entry) {
    entry = { timestamps: [] };
  }

  // Check if currently blocked
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      limit: config.maxRequests,
      resetAt: Math.ceil(entry.blockedUntil / 1000),
      retryAfter,
    };
  }

  // Discard timestamps outside the current window
  entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    // Exceeded: block until the oldest timestamp in window expires
    const oldestInWindow = Math.min(...entry.timestamps);
    const resetAt = oldestInWindow + windowMs;
    entry.blockedUntil = resetAt;
    store.set(key, entry);

    return {
      allowed: false,
      remaining: 0,
      limit: config.maxRequests,
      resetAt: Math.ceil(resetAt / 1000),
      retryAfter: Math.ceil((resetAt - now) / 1000),
    };
  }

  // Record this request
  entry.timestamps.push(now);
  entry.blockedUntil = undefined;
  store.set(key, entry);

  const remaining = config.maxRequests - entry.timestamps.length;
  const resetAt = Math.ceil((now + windowMs) / 1000);

  return {
    allowed: true,
    remaining,
    limit: config.maxRequests,
    resetAt,
  };
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function setRateLimitHeaders(headers: Headers, result: RateLimitResult): void {
  headers.set('X-RateLimit-Limit', String(result.limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(result.resetAt));

  if (result.retryAfter !== undefined) {
    headers.set('Retry-After', String(result.retryAfter));
  }
}

function rateLimitExceededResponse(result: RateLimitResult, message?: string): NextResponse {
  const body = {
    success: false,
    error: 'Too Many Requests',
    message: message || 'Rate limit exceeded. Please try again later.',
    retryAfter: result.retryAfter,
  };

  const response = NextResponse.json(body, { status: 429 });
  setRateLimitHeaders(response.headers, result);
  return response;
}

// ============================================================================
// RATE LIMIT MIDDLEWARE (for Next.js middleware)
// ============================================================================

/**
 * Apply rate limiting inside Next.js middleware.
 * Returns null if allowed, otherwise returns a 429 NextResponse.
 */
export function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): NextResponse | null {
  // Optional skip
  if (config.skipIf?.(request)) return null;

  const clientKey = config.keyFn
    ? config.keyFn(request)
    : getClientIP(request);

  const key = `${config.name}:${clientKey}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    return rateLimitExceededResponse(result, config.message);
  }

  return null; // Allowed – caller continues processing
}

/**
 * Attach rate limit headers to an existing response.
 * Call after applyRateLimit returns null to include informational headers.
 */
export function attachRateLimitHeaders(
  response: NextResponse,
  request: NextRequest,
  config: RateLimitConfig
): void {
  const clientKey = config.keyFn
    ? config.keyFn(request)
    : getClientIP(request);
  const key = `${config.name}:${clientKey}`;
  const entry = store.get(key);
  if (!entry) return;

  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const windowStart = now - windowMs;
  const recentHits = entry.timestamps.filter(ts => ts > windowStart).length;

  response.headers.set('X-RateLimit-Limit', String(config.maxRequests));
  response.headers.set('X-RateLimit-Remaining', String(Math.max(0, config.maxRequests - recentHits)));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
}

// ============================================================================
// ROUTE HANDLER WRAPPER (for API route handlers)
// ============================================================================

/**
 * HOF to wrap a Next.js API route handler with rate limiting.
 *
 * Usage:
 *   export const POST = withRateLimit(handler, {
 *     name: 'auth-login',
 *     maxRequests: 5,
 *     windowSeconds: 900,
 *   });
 */
export function withRateLimit(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse,
  config: RateLimitConfig
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    if (config.skipIf?.(request)) {
      return handler(request, context);
    }

    const clientKey = config.keyFn
      ? config.keyFn(request)
      : getClientIP(request);

    const key = `${config.name}:${clientKey}`;
    const result = checkRateLimit(key, config);

    if (!result.allowed) {
      return rateLimitExceededResponse(result, config.message);
    }

    const response = await handler(request, context);
    setRateLimitHeaders(response.headers, result);
    return response;
  };
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/** Default API routes: 100 req / 60 s */
export const API_RATE_LIMIT: RateLimitConfig = {
  name: 'api',
  maxRequests: 100,
  windowSeconds: 60,
};

/** Authentication endpoints: 10 req / 15 min */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  name: 'auth',
  maxRequests: 10,
  windowSeconds: 900,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
};

/** Login specifically: 5 req / 15 min */
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  name: 'auth-login',
  maxRequests: 5,
  windowSeconds: 900,
  message: 'Too many login attempts. Please try again in 15 minutes.',
};

/** Password reset: 3 req / 60 min */
export const PASSWORD_RESET_RATE_LIMIT: RateLimitConfig = {
  name: 'password-reset',
  maxRequests: 3,
  windowSeconds: 3600,
  message: 'Too many password reset requests. Please try again in an hour.',
};

/** Search: 30 req / 60 s */
export const SEARCH_RATE_LIMIT: RateLimitConfig = {
  name: 'search',
  maxRequests: 30,
  windowSeconds: 60,
};

/** CMS write operations: 30 req / 60 s */
export const CMS_WRITE_RATE_LIMIT: RateLimitConfig = {
  name: 'cms-write',
  maxRequests: 30,
  windowSeconds: 60,
};

/** File uploads: 20 req / 60 s */
export const UPLOAD_RATE_LIMIT: RateLimitConfig = {
  name: 'upload',
  maxRequests: 20,
  windowSeconds: 60,
};

/** Global fallback: 200 req / 60 s */
export const GLOBAL_RATE_LIMIT: RateLimitConfig = {
  name: 'global',
  maxRequests: 200,
  windowSeconds: 60,
};
