/**
 * Common error handling utilities and patterns
 * Use these for consistent error handling across the app
 */

import { trackError, createAsyncErrorHandler, reportIssue } from '@/lib/error-tracking';

/**
 * Safely fetch data with automatic error tracking
 */
export async function safeFetch<T>(
  url: string,
  options?: RequestInit,
  context?: Record<string, unknown>
): Promise<T | null> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    trackError('dataFetchError', error, {
      url,
      method: options?.method || 'GET',
      ...context,
    });
    return null;
  }
}

/**
 * Handle API request errors consistently
 */
export function handleApiError(
  error: unknown,
  context: Record<string, unknown>
) {
  if (error instanceof TypeError) {
    // Network error
    reportIssue('networkError', error.message, context);
  } else if (error instanceof Error) {
    // Standard error
    trackError('apiError', error, context);
  } else {
    // Unknown error
    reportIssue('unknownError', String(error), context);
  }
}

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T>(
  json: string,
  fallback: T,
  context?: Record<string, unknown>
): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    reportIssue('jsonParseError', 'Failed to parse JSON', {
      jsonLength: json.length,
      ...context,
    });
    return fallback;
  }
}

/**
 * Wrap async operations with error tracking
 */
export async function withErrorTracking<T>(
  operation: () => Promise<T>,
  operationType: string,
  context?: Record<string, unknown>
): Promise<T | null> {
  const handleError = createAsyncErrorHandler(operationType);

  try {
    return await operation();
  } catch (error) {
    handleError(error, context);
    return null;
  }
}

/**
 * Safely access local storage with error handling
 */
export function getFromLocalStorage<T>(
  key: string,
  fallback: T,
  context?: Record<string, unknown>
): T {
  try {
    if (typeof window === 'undefined') return fallback;

    const item = window.localStorage?.getItem(key);
    if (!item) return fallback;

    return JSON.parse(item) as T;
  } catch (error) {
    reportIssue('storageAccessError', `Failed to read from localStorage`, {
      key,
      ...context,
    });
    return fallback;
  }
}

/**
 * Safely write to local storage with error handling
 */
export function setInLocalStorage(
  key: string,
  value: unknown,
  context?: Record<string, unknown>
): boolean {
  try {
    if (typeof window === 'undefined') return false;

    window.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    reportIssue('storageWriteError', `Failed to write to localStorage`, {
      key,
      ...context,
    });
    return false;
  }
}

/**
 * Validate data with error tracking
 */
export function validateData<T>(
  data: unknown,
  validatorFn: (data: unknown) => data is T,
  errorMessage: string,
  context?: Record<string, unknown>
): T | null {
  if (!validatorFn(data)) {
    reportIssue('validationError', errorMessage, {
      receivedType: typeof data,
      ...context,
    });
    return null;
  }
  return data;
}

/**
 * Create a debounced error report (prevent spam)
 */
export function createDebouncedErrorReporter(
  type: string,
  debounceMs = 5000
) {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastError: unknown = null;

  return (error: unknown, context?: Record<string, unknown>) => {
    lastError = error;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      trackError(type, lastError, context);
      timeoutId = null;
    }, debounceMs);
  };
}

/**
 * Retry an operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  initialDelayMs = 1000,
  context?: Record<string, unknown>
): Promise<T | null> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  trackError('retryExhausted', lastError, {
    maxAttempts,
    ...context,
  });

  return null;
}
