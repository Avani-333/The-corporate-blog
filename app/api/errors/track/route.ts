import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

interface ErrorReport {
  type: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  url: string;
  userAgent: string;
  timestamp: string;
}

const isDev = process.env.NODE_ENV === 'development';

/**
 * POST /api/errors/track
 * Receives and logs client-side errors
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { errors } = data;

    if (!Array.isArray(errors)) {
      return NextResponse.json(
        { error: 'Invalid errors format' },
        { status: 400 }
      );
    }

    // Log errors to console in development
    if (isDev) {
      console.group('🚨 Client Errors Reported');
      errors.forEach((error: ErrorReport, index: number) => {
        console.error(`[${index + 1}] ${error.type}: ${error.message}`, {
          stack: error.stack,
          context: error.context,
          url: error.url,
          timestamp: error.timestamp,
        });
      });
      console.groupEnd();
    }

    // Send to Sentry
    for (const error of errors) {
      Sentry.captureException(new Error(error.message), {
        tags: {
          type: error.type,
          source: 'client-side',
        },
        extra: {
          ...error.context,
          url: error.url,
          stack: error.stack,
        },
        level: error.type.includes('error') ? 'error' : 'warning',
      });
    }

    // TODO: Also persist to database for dashboards/analytics
    // await logErrorsToDatabase(errors);

    return NextResponse.json(
      { success: true, tracked: errors.length },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error tracking endpoint failed:', error);

    return NextResponse.json(
      { error: 'Failed to track errors' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/errors/track
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
