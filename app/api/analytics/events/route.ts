import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 0;

interface AnalyticsEventEnvelope {
  eventId: string;
  eventName: string;
  eventVersion: string;
  eventAt: string;
  schema?: {
    domain?: string;
    version?: string;
  };
  source: 'web';
  context: {
    pagePath: string;
    pageUrl?: string;
    referrer: string;
    userAgent: string;
    anonymousId: string;
    sessionId?: string;
    locale?: string;
    timezoneOffsetMinutes?: number;
  };
  properties: Record<string, unknown>;
}

interface IngestedAnalyticsRecord extends AnalyticsEventEnvelope {
  ingestedAt: string;
  eventDate: string;
  eventHour: string;
  eventNamespace: string;
}

function isValidEnvelope(payload: unknown): payload is AnalyticsEventEnvelope {
  if (!payload || typeof payload !== 'object') return false;
  const record = payload as Partial<AnalyticsEventEnvelope>;

  return Boolean(
    record.eventId &&
      record.eventName &&
      record.eventVersion &&
      record.eventAt &&
      record.source === 'web' &&
      record.context &&
      typeof record.context.pagePath === 'string' &&
      typeof record.context.referrer === 'string' &&
      typeof record.context.userAgent === 'string' &&
      typeof record.context.anonymousId === 'string' &&
      record.properties &&
      typeof record.properties === 'object'
  );
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as unknown;

    if (!isValidEnvelope(payload)) {
      return NextResponse.json(
        { success: false, error: 'Invalid analytics event payload' },
        { status: 400 }
      );
    }

    const eventAtDate = new Date(payload.eventAt);
    const ingestedAt = new Date().toISOString();

    const normalizedRecord: IngestedAnalyticsRecord = {
      ...payload,
      ingestedAt,
      eventDate: Number.isNaN(eventAtDate.getTime()) ? ingestedAt.slice(0, 10) : eventAtDate.toISOString().slice(0, 10),
      eventHour: Number.isNaN(eventAtDate.getTime()) ? ingestedAt.slice(0, 13) : eventAtDate.toISOString().slice(0, 13),
      eventNamespace: payload.schema?.domain || 'generic',
    };

    // Placeholder sink for future BI pipeline wiring.
    console.log('[analytics-event]', normalizedRecord);

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error) {
    console.error('analytics event ingestion error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid analytics event payload' },
      { status: 400 }
    );
  }
}
