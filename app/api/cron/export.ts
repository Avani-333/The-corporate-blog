import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const EXPORT_API_KEY = process.env.EXPORT_API_KEY;

/**
 * POST /api/cron/export
 * Vercel Cron Function - Triggers weekly database export on backend
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/export",
 *     "schedule": "0 2 * * 1"  // Monday 2 AM UTC
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  // Verify Vercel cron token
  const token = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || token !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Trigger export on backend
    const response = await fetch(`${BACKEND_URL}/api/admin/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-export-key': EXPORT_API_KEY || '',
      },
      body: JSON.stringify({
        formats: 'sql,csv',
        dryRun: false,
        includeCleanup: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Export triggered',
      jobId: data.jobId,
      statusUrl: data.statusUrl,
    });
  } catch (error) {
    console.error('Cron export error:', error);

    return NextResponse.json(
      {
        error: 'Failed to trigger export',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const maxDuration = 60; // 1 minute timeout
