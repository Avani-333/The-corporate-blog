'use client';

import { ReactNode, useEffect, useState } from 'react';
import { reportIssue } from '@/lib/error-tracking';

/**
 * HydrationWarningWrapper Component
 * Wraps content that might cause hydration mismatches
 * (e.g., client-specific content like themes, user preferences)
 */
interface HydrationWarningWrapperProps {
  children: ReactNode;
  suppressWarning?: boolean;
  tag?: keyof JSX.IntrinsicElements;
  className?: string;
}

/**
 * Delays rendering client-only content until after hydration
 * Prevents "Expected ...but received..." hydration mismatch warnings
 */
export function ClientOnly({
  children,
  fallback,
  suppressWarning = true,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  suppressWarning?: boolean;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return fallback ?? null;
  }

  return <>{children}</>;
}

/**
 * Wraps content with hydration mismatch detection and recovery
 */
export function HydrationWarningWrapper({
  children,
  suppressWarning = true,
  tag: Tag = 'div',
  className,
}: HydrationWarningWrapperProps) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !hasHydrated) {
      setHasHydrated(true);
    }
  }, [hasHydrated]);

  // Report if hydration takes too long
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasHydrated) {
        reportIssue('hydrationTimeout', 'Hydration did not complete within 10 seconds', {
          pathname: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
        });
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [hasHydrated]);

  return (
    <Tag className={className} suppressHydrationWarning={suppressWarning}>
      {children}
    </Tag>
  );
}

/**
 * Helper for date-based content that differs between server and client
 * Use this to safely render dates in different formats
 */
export function SafeDateRender({
  date,
  fallback = '—',
}: {
  date: Date | string;
  fallback?: string;
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <>{fallback}</>;
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return <>{dateObj.toLocaleDateString()}</>;
}

/**
 * Suppress hydration warnings for specific elements
 * Use when you intentionally have server/client differences
 */
export function SuppressHydrationWarning({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div suppressHydrationWarning className={className}>
      {children}
    </div>
  );
}
