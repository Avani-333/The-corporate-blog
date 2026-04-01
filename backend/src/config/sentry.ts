/**
 * Sentry Configuration for Backend
 * Error tracking, performance monitoring, and issue management
 */

import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { config } from './environment';

export function initializeSentry(): void {
  if (!config.sentryDsn) {
    console.warn('⚠️ Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
    profilesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
    
    // Integrations
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
      new ProfilingIntegration(),
    ],

    // Performance monitoring
    maxBreadcrumbs: 50,

    // Issue filtering
    beforeSend(event, hint) {
      // Filter out specific errors
      if (hint.originalException instanceof Error) {
        // Ignore 404s and client errors
        if (
          event.message?.includes('404') ||
          event.message?.includes('Not Found')
        ) {
          return null;
        }
      }

      return event;
    },

    // Custom context
    initialScope: {
      tags: {
        service: 'tcb-backend',
        region: process.env.REGION || 'unknown',
      },
      contexts: {
        app: {
          version: process.env.APP_VERSION || '1.0.0',
        },
      },
    },
  });

  Sentry.setContext('config', {
    nodeEnv: config.nodeEnv,
    host: config.host,
    port: config.port,
  });

  console.log('✅ Sentry initialized for backend');
}

/**
 * Sentry request handler middleware
 */
export function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler();
}

/**
 * Sentry error handler middleware
 */
export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler();
}

/**
 * Capture an error with context
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
 * Flush pending events
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  return Sentry.close(timeout);
}

export default Sentry;
