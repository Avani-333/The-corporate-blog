'use client';

import React, { Component, ReactNode } from 'react';
import { trackError } from '@/lib/error-tracking';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  isolate?: boolean; // If true, only catches errors in this component's children
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

/**
 * Error Boundary Component
 * Catches React component errors and provides recovery UI
 * Tracks errors to analytics for monitoring
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorCount = this.state.errorCount + 1;

    // Track error to analytics
    trackError('componentError', error, {
      componentStack: errorInfo.componentStack,
      errorCount,
      boundary: this.props.isolate ? 'isolated' : 'root',
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught error:', error, errorInfo);
    }

    // Update state with error count
    this.setState((prevState) => ({
      ...prevState,
      errorCount,
    }));

    // Auto-reset after a delay (e.g. 60 seconds) if error count is low
    if (errorCount < 3) {
      this.resetTimeoutId = setTimeout(() => {
        this.resetErrorBoundary();
      }, 60000);
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorCount: 0,
    });
  };

  render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV === 'development';

      return (
        this.props.fallback || (
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
                  We've been notified of this issue and are working to fix it. Please try again.
                </p>

                {isDev && this.state.error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-800 dark:text-red-300 font-mono overflow-auto max-h-32">
                    <p className="font-semibold mb-1">Development Error Details:</p>
                    <p className="break-words">{this.state.error.message}</p>
                  </div>
                )}

                <button
                  onClick={this.resetErrorBoundary}
                  className="mt-6 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Try again
                </button>

                <button
                  onClick={() => window.location.href = '/'}
                  className="mt-2 w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                >
                  Go home
                </button>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
