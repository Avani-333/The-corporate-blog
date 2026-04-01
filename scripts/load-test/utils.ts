// Load Test Utilities - Helper functions for testing

import { check } from 'k6';

/**
 * Parse performance targets from environment or use defaults
 */
export function getPerformanceTargets() {
  return {
    p95ResponseTime: parseInt(process.env.P95_TARGET || '500'),
    p99ResponseTime: parseInt(process.env.P99_TARGET || '1000'),
    errorRateThreshold: parseFloat(process.env.ERROR_RATE_THRESHOLD || '0.1'),
    avgResponseTime: parseInt(process.env.AVG_RESPONSE_TARGET || '200'),
  };
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms) {
  const end = new Date().getTime() + ms;
  while (new Date().getTime() < end) {
    // busy wait
  }
}

/**
 * Calculate percentile from array of values
 */
export function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[index];
}

/**
 * Evaluate response time against SLA
 */
export function evaluateResponseTimeSLA(duration, targets) {
  const status = {
    ok: duration < targets.p95ResponseTime,
    warning: duration < targets.p99ResponseTime,
    critical: duration >= targets.p99ResponseTime,
  };

  return status;
}

/**
 * Common response checks
 */
export function checkResponse(response, expectedStatus = 200) {
  return check(response, {
    'status is correct': (r) => r.status === expectedStatus,
    'response has content': (r) => r.body && r.body.length > 0,
    'response time < 1s': (r) => r.timings.duration < 1000,
  });
}

/**
 * API response checks
 */
export function checkAPIResponse(response) {
  return check(response, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'has JSON content': (r) => r.headers['content-type'].includes('application/json'),
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}

/**
 * Cache check (look for cache headers)
 */
export function checkCacheHit(response) {
  const cacheHeader = response.headers['x-cache'] || response.headers['cache-control'] || '';
  return cacheHeader.toLowerCase().includes('hit');
}

/**
 * Generate random string
 */
export function randomString(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random UUID
 */
export function randomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Simulate realistic think time between requests
 */
export function thinkTime(min = 1000, max = 5000) {
  const duration = Math.random() * (max - min) + min;
  const start = Date.now();
  while (Date.now() - start < duration) {
    // busy wait for realistic think time
  }
}

/**
 * Create authorization header for JWT
 */
export function getAuthHeader(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export default {
  getPerformanceTargets,
  sleep,
  percentile,
  evaluateResponseTimeSLA,
  checkResponse,
  checkAPIResponse,
  checkCacheHit,
  randomString,
  randomUUID,
  thinkTime,
  getAuthHeader,
};
