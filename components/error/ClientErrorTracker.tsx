'use client';

import { useEffect } from 'react';
import { useGlobalErrorTracking, useHydrationWarning, usePerformanceMonitoring } from '@/hooks/useErrorTracking';

/**
 * ClientErrorTracker Component
 * Initializes global error tracking and monitoring
 * Should be rendered near the root of the app
 */
export function ClientErrorTracker() {
  // Initialize error tracking
  useGlobalErrorTracking();

  // Monitor for hydration warnings
  useHydrationWarning();

  // Monitor performance
  usePerformanceMonitoring();

  // Set up global error handlers
  useEffect(() => {
    // Initialize error tracking by importing it (has side effects)
    // Already happens when lib/error-tracking.ts is imported
    // This effect just ensures it happens on client

    // Additional tracking: Log page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden - flush pending errors
        import('@/lib/error-tracking').then(({ flushErrors }) => {
          flushErrors();
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
