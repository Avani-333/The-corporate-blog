import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 0;

interface WebVitalMetric {
  id: string;
  name: string;
  value: number;
  delta: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
  navigationType?: string;
  pathname?: string;
  userAgent?: string;
}

export async function POST(request: NextRequest) {
  try {
    const metric = (await request.json()) as WebVitalMetric;

    const safeMetric = {
      ...metric,
      pathname: metric.pathname || request.nextUrl.pathname,
      userAgent: request.headers.get('user-agent') || 'unknown',
      receivedAt: new Date().toISOString(),
    };

    // Placeholder sink for observability. Wire this to your analytics backend as needed.
    console.log('[web-vitals]', safeMetric);

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error) {
    console.error('web-vitals ingestion error:', error);
    return NextResponse.json({ success: false, error: 'Invalid metric payload' }, { status: 400 });
  }
}
