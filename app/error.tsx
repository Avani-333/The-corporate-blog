'use client';

import { useEffect } from 'react';
import { trackError } from '@/lib/error-tracking';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root Error Page
 * Handles errors thrown during rendering of the app
 * This is automatically rendered by Next.js when an error occurs
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Track the error
    trackError('pageError', error, {
      digest: error.digest,
    });

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Page error:', error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900 rounded-full">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <h1 className="mt-4 text-lg font-semibold text-center text-gray-900 dark:text-white">
                Something went wrong
              </h1>

              <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
                An unexpected error occurred. We've been notified and are investigating.
              </p>

              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-800 dark:text-red-300 font-mono overflow-auto max-h-40">
                  <p className="font-semibold mb-1">Error Details:</p>
                  <p className="break-words">{error.message}</p>
                  {error.stack && (
                    <pre className="mt-2 text-[10px] overflow-auto max-h-24">
                      {error.stack}
                    </pre>
                  )}
                </div>
              )}

              <button
                onClick={reset}
                className="mt-6 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Try again
              </button>

              <button
                onClick={() => (window.location.href = '/')}
                className="mt-2 w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
              >
                Go home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
