/**
 * Example: Using Error Boundaries and Error Tracking
 * This file demonstrates best practices for error handling across the app
 */

// ============================================================================
// Example 1: Using Error Boundaries in a Page
// ============================================================================

import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { ClientOnly } from '@/components/error/HydrationWarningWrapper';
import { PostList } from '@/components/blog/PostList';

export function BlogPageExample() {
  return (
    <div>
      <h1>Blog Posts</h1>

      {/* Wrap potentially error-prone features in error boundaries */}
      <ErrorBoundary
        fallback={
          <div className="p-4 bg-yellow-100 border border-yellow-300 rounded">
            Unable to load posts. Please refresh the page.
          </div>
        }
        onError={(error) => {
          console.log('Error loading posts:', error);
        }}
      >
        <PostList />
      </ErrorBoundary>

      {/* Wrap client-only content to prevent hydration mismatches */}
      <ClientOnly fallback={<div>Loading recommendations...</div>}>
        <RecommendedPosts />
      </ClientOnly>
    </div>
  );
}

// ============================================================================
// Example 2: Tracking Errors in Data Fetching
// ============================================================================

import { safeFetch, handleApiError } from '@/lib/error-utils';
import { trackError } from '@/lib/error-tracking';

async function fetchPostsExample() {
  // Method 1: Using safeFetch utility (recommended)
  const posts = await safeFetch('/api/posts', undefined, {
    source: 'blogPage',
  });

  if (!posts) {
    // Error already tracked by safeFetch
    return [];
  }

  // Method 2: Manual error tracking
  try {
    const response = await fetch('/api/categories');
    const categories = await response.json();
    return categories;
  } catch (error) {
    handleApiError(error, {
      endpoint: '/api/categories',
      method: 'GET',
    });
    return [];
  }
}

// ============================================================================
// Example 3: Using Error Tracking in Components
// ============================================================================

import { useEffect, useState } from 'react';
import { reportIssue } from '@/lib/error-tracking';
import { getFromLocalStorage } from '@/lib/error-utils';

export function UserPreferencesExample() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    // Safely access localStorage with error tracking
    const savedTheme = getFromLocalStorage('theme', 'light', {
      component: 'UserPreferences',
    });

    setTheme(savedTheme);

    // Validate user state
    if (!savedTheme) {
      reportIssue('missingTheme', 'User theme preference is missing', {
        userId: 'user123',
      });
    }
  }, []);

  return <div>{theme}</div>;
}

// ============================================================================
// Example 4: Handling Async Operations with Error Tracking
// ============================================================================

import { withErrorTracking, retryWithBackoff } from '@/lib/error-utils';
import { createAsyncErrorHandler } from '@/lib/error-tracking';

// Method 1: Using withErrorTracking wrapper
async function submitFormExample() {
  const result = await withErrorTracking(
    async () => {
      const response = await fetch('/api/posts/create', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Post' }),
      });
      return response.json();
    },
    'postCreation',
    { postTitle: 'My Post' }
  );

  if (!result) {
    // Error already tracked
    return;
  }

  // Use the result
}

// Method 2: Using custom error handler
async function publishPostExample(postId: string) {
  const handleError = createAsyncErrorHandler('publishPost');

  try {
    const response = await fetch(`/api/posts/${postId}/publish`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    handleError(error, {
      postId,
      action: 'publish',
    });
    throw error;
  }
}

// Method 3: Using retry with exponential backoff
async function fetchWithRetryExample() {
  const result = await retryWithBackoff(
    async () => {
      const response = await fetch('/api/posts');
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    3, // max attempts
    1000, // initial delay in ms
    { source: 'postList' }
  );

  return result || [];
}

// ============================================================================
// Example 5: Handling Validation Errors
// ============================================================================

import { validateData } from '@/lib/error-utils';

interface Post {
  id: string;
  title: string;
  content: string;
}

function isPost(data: unknown): data is Post {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'title' in data &&
    'content' in data
  );
}

function processPostExample(data: unknown) {
  const post = validateData(
    data,
    isPost,
    'Invalid post object received from API',
    { source: 'postProcessor' }
  );

  if (!post) {
    // Validation failed, error already tracked
    return null;
  }

  // Use the validated post
  return post;
}

// ============================================================================
// Example 6: Preventing Hydration Mismatches
// ============================================================================

import { SafeDateRender, SuppressHydrationWarning } from '@/components/error/HydrationWarningWrapper';

export function PostMetadataExample({ post }: { post: any }) {
  return (
    <div>
      {/* Don't use new Date() directly - causes hydration mismatch */}
      {/* ❌ Wrong */}
      {/* <div>{new Date().toLocaleDateString()}</div> */}

      {/* ✅ Right - Use SafeDateRender */}
      <div>
        Published: <SafeDateRender date={post.publishedAt} />
      </div>

      {/* Or use ClientOnly for client-specific features */}
      <ClientOnly fallback="—">
        <CurrentTime />
      </ClientOnly>

      {/* For intentional server/client differences */}
      <SuppressHydrationWarning>
        <ThemeSelector /> {/* Theme may differ on initial load */}
      </SuppressHydrationWarning>
    </div>
  );
}

function CurrentTime() {
  return <>{new Date().toLocaleTimeString()}</>;
}

function RecommendedPosts() {
  return <div>Recommended posts would load here</div>;
}

function ThemeSelector() {
  return <div>Theme selector button...</div>;
}

// ============================================================================
// Example 7: Testing Error Boundaries
// ============================================================================

export function TestErrorBoundaryExample() {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    throw new Error('This is a test error from a component');
  }

  return (
    <div>
      <p>Testing error boundary...</p>
      <button onClick={() => setShouldError(true)}>
        Throw Error
      </button>
    </div>
  );
}

// Wrap it in error boundary
export function TestErrorBoundaryPageExample() {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 bg-red-100 border border-red-300 rounded">
          Error occurred in test component
        </div>
      }
    >
      <TestErrorBoundaryExample />
    </ErrorBoundary>
  );
}

// ============================================================================
// Example 8: Debounced Error Reporting
// ============================================================================

import { createDebouncedErrorReporter } from '@/lib/error-utils';

const debouncedInputError = createDebouncedErrorReporter('inputValidation', 2000);

export function SearchBoxExample() {
  const [query, setQuery] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Only report error if input is invalid after 2 seconds of inactivity
    if (value.includes('<script>')) {
      debouncedInputError(new Error('Potentially malicious input detected'), {
        value: value.substring(0, 50),
      });
    }
  };

  return <input value={query} onChange={handleInputChange} />;
}

// ============================================================================
// Example 9: Wrapping External Library Calls
// ============================================================================

import { wrapWithErrorTracking } from '@/lib/error-tracking';

// Wrap a third-party function to track its errors
async function externalLibraryCallExample() {
  // Create a safe version of the fetch function
  const safeFetchVersion = wrapWithErrorTracking(fetch, 'externalLibraryCall');

  try {
    const response = await safeFetchVersion('https://api.example.com/data');
    return response;
  } catch (error) {
    // Error already tracked by wrapper
    console.error('Failed to fetch from external API');
    return null;
  }
}

// ============================================================================
// Example 10: Custom Error Reporting
// ============================================================================

import { reportIssue, flushErrors } from '@/lib/error-tracking';

export function DataValidationExample() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/data');
        const json = await response.json();

        // Validate expected fields
        if (!json.id || !json.name) {
          reportIssue(
            'incompleteDdata',
            'API returned data without required fields',
            {
              receivedFields: Object.keys(json),
              expectedFields: ['id', 'name'],
              endpoint: '/api/data',
            }
          );
          return;
        }

        setData(json);
      } catch (error) {
        console.error(error);
      }

      // Flush errors before component unmounts
      return () => {
        flushErrors();
      };
    };

    loadData();
  }, []);

  return <div>{data ? JSON.stringify(data) : 'No data'}</div>;
}

// ============================================================================
// Notes
// ============================================================================

/*
Key Principles:

1. ERROR BOUNDARIES
   - Place error boundaries strategically, not everywhere
   - Wrap features that might fail independently
   - One per page section is often sufficient

2. ERROR TRACKING
   - Track errors with meaningful context
   - Include identifiers (userId, postId, etc.)
   - Provide enough context to reproduce the issue

3. HYDRATION
   - Use ClientOnly for client-specific features
   - Use SafeDateRender for date/time
   - Use SuppressHydrationWarning only when necessary

4. BEST PRACTICES
   - Catch errors early and track them
   - Provide user-friendly error messages
   - Log detailed context in development
   - Flush errors before page unload
   - Test error boundaries during development

5. AVOID
   - Suppressing all hydration warnings
   - Generic error messages
   - Missing error context
   - Ignoring errors in production
   - Rendering different content on server vs client without ClientOnly
*/
