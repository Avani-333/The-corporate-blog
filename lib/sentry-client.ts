/**
 * Sentry Configuration for Frontend (Next.js)
 * Error tracking, performance monitoring, and issue management
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Initialize Sentry for the frontend
 * Call this before any other code runs
 */
export function initializeSentryFrontend(): void {
  if (!dsn) {
    console.warn('⚠️ Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Issue filtering
    beforeSend(event, hint) {
      // Filter out specific errors
      const error = hint.originalException;

      if (
        error instanceof Error &&
        (error.message.includes('404') ||
          error.message.includes('Not Found') ||
          error.message.includes('ResizeObserver loop'))
      ) {
        return null;
      }

      return event;
    },

    // Ignore certain errors in development
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Ignore ResizeObserver errors
      'ResizeObserver loop',
      // Random plugins/extensions
      'chrome-extension://',
      'moz-extension://',
    ],

    // Initial scope with context
    initialScope: {
      tags: {
        service: 'tcb-frontend',
        type: 'browser',
      },
      contexts: {
        app: {
          version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        },
      },
    },
  });

  console.log('✅ Sentry initialized for frontend');
}

/**
 * Capture an exception with context
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
    level: 'error',
  });
}

/**
 * Capture a message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for tracking
 */
export function setUserContext(userId: string, userEmail?: string, username?: string) {
  Sentry.setUser({
    id: userId,
    email: userEmail,
    username,
  });
}

/**
 * Clear user context
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for tracking
 */
export function addBreadcrumb(
  message: string,
  category: string = 'action',
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Capture a custom metric/event for performance monitoring
 * Note: This is a stub for compatibility. Dynamic measurements are handled by Sentry SDK.
 */
export function captureMetric(name: string, value: number, unit = 'ms') {
  // In @sentry/nextjs, measurements are typically captured via spans or transactions
  // This is a placeholder for backward compatibility
  console.debug(`[Sentry] Metric: ${name} = ${value}${unit}`);
}

export default Sentry;
