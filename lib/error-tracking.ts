/**
 * Client-side error tracking and reporting
 * Captures runtime errors and sends them to analytics and Sentry
 */

import { captureException, captureMessage, addBreadcrumb } from '@/lib/sentry-client';

interface ErrorContext {
  [key: string]: unknown;
}

interface ErrorReport {
  type: string;
  message: string;
  stack?: string;
  context?: ErrorContext;
  url: string;
  userAgent: string;
  timestamp: string;
}

const ERROR_ENDPOINT = '/api/errors/track';

class ErrorTracker {
  private errorQueue: ErrorReport[] = [];
  private isReporting = false;
  private maxQueueSize = 50;

  /**
   * Initialize error tracking
   * Sets up global error handlers
   */
  init() {
    if (typeof window === 'undefined') return;

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.trackError('uncaughtError', event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError('unhandledRejection', event.reason, {
        promise: event.promise,
      });
    });
  }

  /**
   * Track an error with context
   */
  trackError(type: string, error: unknown, context?: ErrorContext) {
    if (typeof window === 'undefined') return;

    const errorObj = error instanceof Error ? error : new Error(String(error));

    const report: ErrorReport = {
      type,
      message: errorObj.message,
      stack: errorObj.stack,
      context,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    // Send to Sentry immediately
    captureException(errorObj, {
      type,
      ...context,
    });

    this.addToQueue(report);
    this.reportErrors();
  }

  /**
   * Add error to queue
   */
  private addToQueue(report: ErrorReport) {
    this.errorQueue.push(report);

    // Prevent unbounded queue growth
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }
  }

  /**
   * Send errors to backend
   */
  private async reportErrors() {
    if (this.isReporting || this.errorQueue.length === 0) return;

    this.isReporting = true;

    try {
      const errors = [...this.errorQueue];
      this.errorQueue = [];

      await fetch(ERROR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors }),
        keepalive: true, // Ensure request completes even if page unloads
      });
    } catch (error) {
      // If reporting fails, add errors back to queue
      // But only if queue isn't too full
      if (this.errorQueue.length < this.maxQueueSize - 10) {
        console.error('Failed to report errors:', error);
      }
    } finally {
      this.isReporting = false;
    }
  }

  /**
   * Force flush errors before page unload
   */
  flush() {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];

    // Use sendBeacon for reliability
    if (navigator.sendBeacon) {
      const payload = JSON.stringify({ errors });
      navigator.sendBeacon(ERROR_ENDPOINT, payload);
    } else {
      // Fallback: synchronous fetch (deprecated but reliable)
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', ERROR_ENDPOINT, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({ errors }));
      } catch (error) {
        // Silently fail
      }
    }
  }
}

// Singleton instance
const tracker = new ErrorTracker();

// Initialize on first import
if (typeof window !== 'undefined') {
  tracker.init();

  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    tracker.flush();
  });
}

/**
 * Track an error with context
 * @example
 * trackError('dataFetchError', error, { endpoint: '/api/posts', method: 'GET' })
 */
export function trackError(type: string, error: unknown, context?: ErrorContext) {
  tracker.trackError(type, error, context);
}

/**
 * Wrap a function to automatically track errors
 * @example
 * const safeFetch = wrapWithErrorTracking(fetch, 'apiCall');
 */
export function wrapWithErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  errorType: string
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      trackError(errorType, error, { args: String(args) });
      throw error;
    }
  }) as T;
}

/**
 * Create an error handler for async operations
 * @example
 * const handleError = createAsyncErrorHandler('formSubmit');
 * try { ... } catch(e) { handleError(e); }
 */
export function createAsyncErrorHandler(errorType: string) {
  return (error: unknown, context?: ErrorContext) => {
    trackError(errorType, error, context);
  };
}

/**
 * Report a custom error or issue
 * @example
 * reportIssue('hydrationMismatch', 'Expected "true" but received "false"')
 */
export function reportIssue(type: string, message: string, context?: ErrorContext) {
  const error = new Error(message);
  
  // Send to Sentry with issue type
  captureException(error, {
    issueType: type,
    ...context,
  });

  // Also track locally
  trackError(`issue:${type}`, error, context);
}

/**
 * Flush pending errors (useful for testing or before critical operations)
 */
export function flushErrors() {
  tracker.flush();
}

export default tracker;
