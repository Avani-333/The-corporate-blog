'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/contexts/AuthContext';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary isolate>
      <SessionProvider>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
            storageKey="tcb-theme"
          >
            <AnalyticsProvider>{children}</AnalyticsProvider>
          </ThemeProvider>
        </AuthProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}