'use client';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { ExternalAnalytics } from '@/components/analytics/ExternalAnalytics';
import { WebVitalsReporter } from '@/components/analytics/WebVitalsReporter';
import { ClientErrorTracker } from '@/components/error/ClientErrorTracker';

interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  return (
    <>
      <ClientErrorTracker />
      <ExternalAnalytics />
      <WebVitalsReporter />
      <ErrorBoundary isolate>
        {children}
      </ErrorBoundary>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
