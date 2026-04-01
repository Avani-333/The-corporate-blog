'use client';

import { useEffect } from 'react';
import { reportIssue } from '@/lib/error-tracking';

/**
 * Hook to detect and report hydration mismatches
 */
export function useHydrationWarning() {
  useEffect(() => {
    // Check for hydration warnings
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes('hydration')) {
          reportIssue('hydrationWarning', `Performance warning: ${entry.name}`, {
            duration: entry.duration,
            entryType: entry.entryType,
          });
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['measure', 'mark'] });
    } catch (error) {
      // PerformanceObserver might not support these entry types
    }

    return () => observer.disconnect();
  }, []);
}

/**
 * Hook to set up global error tracking
 */
export function useGlobalErrorTracking() {
  useEffect(() => {
    // This initializes the error tracking system
    // Actual initialization happens in error-tracking.ts on import
    // This hook is mainly for ensuring it's properly initialized in client components
  }, []);
}

/**
 * Hook to detect memory leaks and performance issues
 */
export function usePerformanceMonitoring() {
  useEffect(() => {
    // Monitor for long tasks that might indicate issues
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // Report long tasks (> 50ms)
            if (
              entry.duration > 50 &&
              process.env.NODE_ENV === 'development'
            ) {
              console.warn(`Long task detected: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
            }
          }
        });

        observer.observe({ entryTypes: ['longtask'] });
        return () => observer.disconnect();
      } catch (error) {
        // PerformanceObserver might not support longtask
      }
    }

    return undefined;
  }, []);
}
