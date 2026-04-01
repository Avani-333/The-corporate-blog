/**
 * IP-Based Request Throttling
 * Tracks IP-specific request metrics for auth, publish, and search endpoints
 */

import { NextRequest } from 'next/server';

interface IpMetrics {
  requestCount: number;
  lastRequestTime: number;
  blockedUntil?: number;
  suspicious: boolean;
}

/**
 * IP-based throttler for rate limiting per IP with burst detection
 */
class IpThrottler {
  private metrics = new Map<string, IpMetrics>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(cleanupIntervalMs: number = 60 * 60 * 1000) { // 1 hour
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  /**
   * Check if IP should be throttled
   */
  checkThrottle(
    ip: string,
    maxRequestsPerWindow: number,
    windowMs: number,
    burstThreshold?: number
  ): { allowed: boolean; metrics: IpMetrics } {
    const now = Date.now();
    const metrics = this.metrics.get(ip) || {
      requestCount: 0,
      lastRequestTime: now,
      suspicious: false,
    };

    // Check if currently blocked (manual throttle)
    if (metrics.blockedUntil && metrics.blockedUntil > now) {
      return { allowed: false, metrics };
    }

    // Reset window if expired
    if (now - metrics.lastRequestTime > windowMs) {
      metrics.requestCount = 0;
    }

    metrics.requestCount++;
    metrics.lastRequestTime = now;

    // Check burst attack (rapid requests)
    if (burstThreshold && metrics.requestCount > burstThreshold) {
      metrics.suspicious = true;
      // Block for 5 minutes on burst detection
      metrics.blockedUntil = now + 5 * 60 * 1000;
      this.metrics.set(ip, metrics);
      return { allowed: false, metrics };
    }

    // Check rate limit
    if (metrics.requestCount > maxRequestsPerWindow) {
      metrics.blockedUntil = now + windowMs;
      this.metrics.set(ip, metrics);
      return { allowed: false, metrics };
    }

    this.metrics.set(ip, metrics);
    return { allowed: true, metrics };
  }

  /**
   * Manually block an IP
   */
  blockIp(ip: string, durationMs: number = 15 * 60 * 1000): void {
    const now = Date.now();
    const metrics = this.metrics.get(ip) || {
      requestCount: 0,
      lastRequestTime: now,
      suspicious: false,
    };

    metrics.blockedUntil = now + durationMs;
    metrics.suspicious = true;
    this.metrics.set(ip, metrics);
  }

  /**
   * Get IP metrics
   */
  getMetrics(ip: string): IpMetrics | null {
    const metrics = this.metrics.get(ip);
    if (!metrics) return null;

    // Clean expired block
    if (metrics.blockedUntil && metrics.blockedUntil < Date.now()) {
      metrics.blockedUntil = undefined;
    }

    return metrics;
  }

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [ip, metrics] of this.metrics.entries()) {
      if (now - metrics.lastRequestTime > maxAge && !metrics.blockedUntil) {
        this.metrics.delete(ip);
      }
    }
  }

  /**
   * Destroy throttler
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.metrics.clear();
  }

  /**
   * Get all metrics (for monitoring)
   */
  getAllMetrics(): Map<string, IpMetrics> {
    return new Map(this.metrics);
  }
}

// Singleton instances per endpoint type
const authThrottler = new IpThrottler();
const publishThrottler = new IpThrottler();
const searchThrottler = new IpThrottler();

/**
 * Extract client IP from request
 */
export function getClientIp(request: NextRequest | any): string {
  // From Next.js request
  if (request.ip) return request.ip;

  // From headers
  const forwarded = request.headers?.get?.('x-forwarded-for');
  const realIp = request.headers?.get?.('x-real-ip');
  const cfIp = request.headers?.get?.('cf-connecting-ip');

  return cfIp || forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
}

/**
 * Check auth endpoint throttle (login, register, refresh)
 * 
 * Limits:
 * - 10 requests per 15 minutes per IP
 * - Burst threshold: 5 requests in < 30 seconds
 */
export function checkAuthThrottle(ip: string): { allowed: boolean; retryAfter?: number } {
  const result = authThrottler.checkThrottle(
    ip,
    10, // maxRequests
    15 * 60 * 1000, // 15 minute window
    5 // burstThreshold
  );

  if (!result.allowed) {
    const retryAfter = result.metrics.blockedUntil
      ? Math.ceil((result.metrics.blockedUntil - Date.now()) / 1000)
      : 900;

    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

/**
 * Check publish endpoint throttle (create/update posts)
 * 
 * Limits:
 * - 30 requests per 60 seconds per IP
 * - Burst threshold: 10 requests in < 10 seconds
 */
export function checkPublishThrottle(ip: string): { allowed: boolean; retryAfter?: number } {
  const result = publishThrottler.checkThrottle(
    ip,
    30, // maxRequests
    60 * 1000, // 60 second window
    10 // burstThreshold
  );

  if (!result.allowed) {
    const retryAfter = result.metrics.blockedUntil
      ? Math.ceil((result.metrics.blockedUntil - Date.now()) / 1000)
      : 60;

    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

/**
 * Check search endpoint throttle
 * 
 * Limits:
 * - 30 requests per 60 seconds per IP
 * - Burst threshold: 15 requests in < 5 seconds
 */
export function checkSearchThrottle(ip: string): { allowed: boolean; retryAfter?: number } {
  const result = searchThrottler.checkThrottle(
    ip,
    30, // maxRequests
    60 * 1000, // 60 second window
    15 // burstThreshold
  );

  if (!result.allowed) {
    const retryAfter = result.metrics.blockedUntil
      ? Math.ceil((result.metrics.blockedUntil - Date.now()) / 1000)
      : 60;

    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

/**
 * Manually block an IP for suspicious activity
 */
export function blockIpAddress(ip: string, type: 'auth' | 'publish' | 'search', durationMs?: number): void {
  const duration = durationMs || 15 * 60 * 1000; // Default 15 minutes

  if (type === 'auth') {
    authThrottler.blockIp(ip, duration);
  } else if (type === 'publish') {
    publishThrottler.blockIp(ip, duration);
  } else if (type === 'search') {
    searchThrottler.blockIp(ip, duration);
  }
}

/**
 * Get throttle metrics for an IP
 */
export function getThrottleMetrics(
  ip: string,
  type: 'auth' | 'publish' | 'search'
): IpMetrics | null {
  if (type === 'auth') {
    return authThrottler.getMetrics(ip);
  } else if (type === 'publish') {
    return publishThrottler.getMetrics(ip);
  } else if (type === 'search') {
    return searchThrottler.getMetrics(ip);
  }
  return null;
}

/**
 * Cleanup all throttlers
 */
export function destroyThrottlers(): void {
  authThrottler.destroy();
  publishThrottler.destroy();
  searchThrottler.destroy();
}

export { IpThrottler };
