# Error Boundaries and Error Tracking Guide

This guide explains how to use error boundaries, error tracking, and hydration mismatch prevention in The Corporate Blog codebase.

## Overview

The error handling system consists of three main components:

1. **Error Boundaries** - React error boundaries to catch component rendering errors
2. **Error Tracking** - Client-side error tracking and reporting to the backend
3. **Hydration Mismatch Prevention** - Tools to prevent and detect hydration issues

## Error Boundaries

### Root Error Boundary

The app has a global error boundary wrapping all providers in `app/providers.tsx`. This catches errors that occur during:
- Provider initialization
- Critical component rendering
- Unhandled rejections (when caught by React)

### Creating Local Error Boundaries

Wrap specific sections of your app to isolate errors:

```tsx
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

export function MyComponent() {
  return (
    <ErrorBoundary
      fallback={<div>Error loading this section</div>}
      onError={(error, errorInfo) => {
        // Custom error handling
        console.log('Custom handler:', error);
      }}
    >
      <ExpensiveFeature />
    </ErrorBoundary>
  );
}
```

### Error Boundary Props

```typescript
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;  // Custom error UI
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;  // Callback
  isolate?: boolean;  // If true, only catches children errors
}
```

### Features

- **Automatic error tracking** - Errors are automatically reported to analytics
- **Auto-recovery** - Attempts to recover after 60 seconds with low error counts
- **Development mode** - Shows detailed error info in development
- **Production mode** - Shows user-friendly error message

## Client Error Tracking

### Basic Error Tracking

```tsx
import { trackError } from '@/lib/error-tracking';

try {
  // Your code
} catch (error) {
  trackError('myError', error, {
    action: 'fetchData',
    endpoint: '/api/posts',
  });
}
```

### Error Types

Predefined error types for categorization:

- `uncaughtError` - Global uncaught errors
- `unhandledRejection` - Unhandled promise rejections
- `componentError` - React component errors (from error boundaries)
- `pageError` - Page-level rendering errors
- `hydrationMismatch` - Hydration issues
- `apiError` - API call failures
- `validationError` - Data validation failures
- Custom types - Use `issue:*` prefix for custom issues

### Advanced Tracking

#### Wrap Functions

```tsx
import { wrapWithErrorTracking } from '@/lib/error-tracking';

const safeFetch = wrapWithErrorTracking(fetch, 'apiCall');
const response = await safeFetch('/api/posts');
```

#### Async Error Handlers

```tsx
import { createAsyncErrorHandler } from '@/lib/error-tracking';

const handleError = createAsyncErrorHandler('formSubmit');

try {
  await submitForm();
} catch (error) {
  handleError(error, { formId: 'contact' });
}
```

#### Report Custom Issues

```tsx
import { reportIssue } from '@/lib/error-tracking';

if (!user) {
  reportIssue('missingUser', 'User object was null', {
    context: 'profilePage',
    userId: id,
  });
}
```

### Error Tracking Hooks

Use these hooks in client components:

```tsx
import { 
  useGlobalErrorTracking,
  useHydrationWarning,
  usePerformanceMonitoring 
} from '@/hooks/useErrorTracking';

export function MyComponent() {
  // Initialize error tracking
  useGlobalErrorTracking();

  // Monitor for hydration warnings
  useHydrationWarning();

  // Monitor performance (logs long tasks in dev)
  usePerformanceMonitoring();

  return <div>...</div>;
}
```

### Error Reporting Endpoint

Client errors are sent to `POST /api/errors/track`. The endpoint:

- Logs errors to console in development
- Accepts batch error reports
- Returns success status

**Example payload:**

```json
{
  "errors": [
    {
      "type": "apiError",
      "message": "Failed to fetch posts",
      "stack": "Error: ...",
      "context": { "endpoint": "/api/posts" },
      "url": "https://example.com/blog",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2024-03-20T10:30:00Z"
    }
  ]
}
```

## Hydration Mismatch Prevention

### The Problem

Hydration mismatches occur when server-rendered HTML differs from client-rendered HTML:

```
Expected "true" but received "false"
```

Common causes:
- Using theme/dark mode without client-only rendering
- Using `new Date()` to render current time
- Using browser APIs before hydration
- Random values in rendering

### Solutions

#### 1. Use ClientOnly Component

For content that's only available on the client:

```tsx
import { ClientOnly } from '@/components/error/HydrationWarningWrapper';

export function MyComponent() {
  return (
    <ClientOnly fallback={<Skeleton />}>
      <ThemeSelector />
    </ClientOnly>
  );
}
```

#### 2. Suppress Warnings Intentionally

When you intentionally have server/client differences:

```tsx
import { SuppressHydrationWarning } from '@/components/error/HydrationWarningWrapper';

export function TimeDisplay() {
  return (
    <SuppressHydrationWarning>
      {new Date().toLocaleString()}
    </SuppressHydrationWarning>
  );
}
```

#### 3. Safe Date Rendering

```tsx
import { SafeDateRender } from '@/components/error/HydrationWarningWrapper';

export function PostDate({ date }) {
  return <SafeDateRender date={date} />;
}
```

#### 4. Hydration Warning Wrapper

For more control:

```tsx
import { HydrationWarningWrapper } from '@/components/error/HydrationWarningWrapper';

export function MyComponent() {
  return (
    <HydrationWarningWrapper suppressWarning>
      {children}
    </HydrationWarningWrapper>
  );
}
```

### Root Element

The root `<html>` element has `suppressHydrationWarning` due to theme provider:

```tsx
<html suppressHydrationWarning>
  {/* ... */}
</html>
```

## Using Providers

The app structure wraps everything with error handling:

```
html
  └─ body
      └─ Providers (ErrorBoundary)
          ├─ SessionProvider
          ├─ AuthProvider
          ├─ ThemeProvider
          ├─ AnalyticsProvider (ErrorBoundary)
          │   ├─ ClientErrorTracker
          │   ├─ ExternalAnalytics
          │   └─ WebVitalsReporter
          └─ children
```

Each provider layer can catch errors independently.

## Best Practices

### ✅ Do

- Wrap feature sections in error boundaries to isolate failures
- Track meaningful context with errors (userId, page, action)
- Use `ClientOnly` for client-specific features
- Flush errors before critical operations: `flushErrors()`
- Test error boundaries during development

### ❌ Don't

- Suppress suppression warnings throughout the app
- Ignore hydration warnings in production
- Track overly verbose error information
- Skip error boundaries in critical features

## Testing Error Boundaries

### Trigger an Error

```tsx
export function TestError() {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    throw new Error('Test error from component');
  }

  return (
    <button onClick={() => setShouldError(true)}>
      Trigger Error
    </button>
  );
}
```

### Test Error Tracking

```tsx
import { reportIssue } from '@/lib/error-tracking';

export function TestTracking() {
  return (
    <button onClick={() => reportIssue('test', 'Test issue')}>
      Report Test Issue
    </button>
  );
}
```

## Debugging

### Development

In development, errors show detailed stack traces and component stacks. Check:

1. Browser console for error logs
2. Network tab for `/api/errors/track` requests
3. Component stack in error boundary UI

### Production

In production, errors are logged silently. Check:

1. Error tracking service (configure in `/api/errors/track`)
2. Logs from `/api/errors/track` endpoint
3. Browser console (if error tracking fails)

## Integration with External Services

To integrate with error tracking services like Sentry or Rollbar:

1. Update `/api/errors/track` endpoint:

```typescript
export async function POST(request: NextRequest) {
  const data = await request.json();
  const { errors } = data;

  // Send to Sentry
  for (const error of errors) {
    await Sentry.captureException(new Error(error.message), {
      extra: error.context,
      tags: { type: error.type },
    });
  }

  return NextResponse.json({ success: true });
}
```

2. Or instrument client tracking directly:

```typescript
// In lib/error-tracking.ts
import * as Sentry from '@sentry/nextjs';

export function trackError(type: string, error: unknown, context?: ErrorContext) {
  Sentry.captureException(error, {
    tags: { errorType: type },
    extra: context,
  });
}
```

## API Reference

### Functions

#### `trackError(type, error, context?)`

Track an error with context.

#### `wrapWithErrorTracking(fn, errorType)`

Wrap a function to automatically track errors.

#### `createAsyncErrorHandler(errorType)`

Create an error handler for async operations.

#### `reportIssue(type, message, context?)`

Report a custom issue or observation.

#### `flushErrors()`

Force flush pending errors (useful before unload).

### Components

#### `<ErrorBoundary>`

Catch and handle component errors.

#### `<ClientOnly>`

Render content only on client (after hydration).

#### `<HydrationWarningWrapper>`

Wrap content with hydration detection.

#### `<SuppressHydrationWarning>`

Intentionally suppress hydration warnings.

#### `<SafeDateRender>`

Safely render dates without hydration mismatches.

### Hooks

#### `useGlobalErrorTracking()`

Initialize global error tracking.

#### `useHydrationWarning()`

Detect and report hydration warnings.

#### `usePerformanceMonitoring()`

Monitor for long tasks and performance issues.

## Monitoring

The system automatically tracks:

- Uncaught errors
- Unhandled promise rejections
- Component rendering errors
- Hydration mismatches (with detection)
- Performance issues (long tasks)
- Error recovery status

All errors are reported with:

- Error type and message
- Stack trace
- Component stack (for component errors)
- Page URL
- User agent
- Timestamp
- Custom context

## See Also

- [Next.js Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Error Tracking Best Practices](https://www.sentry.io/resources/articles/error-tracking-best-practices/)
