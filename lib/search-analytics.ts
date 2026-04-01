export type SearchAnalyticsEventName =
  | 'search_preview_viewed'
  | 'search_submitted'
  | 'search_result_clicked'
  | 'search_results_loaded';

export interface SearchAnalyticsProperties {
  surface: 'search_page' | 'search_modal' | 'search_results_page';
  query: string;
  queryLength: number;
  resultCount?: number;
  hasResults?: boolean;
  queryTerms?: string[];
  resultIds?: string[];
  requestId?: string;
  interactionMode?: 'preview' | 'full_results';
  sort?: 'relevance' | 'date';
  page?: number;
  limit?: number;
  position?: number;
  resultSlug?: string;
}

interface AnalyticsEventEnvelope {
  eventId: string;
  eventName: SearchAnalyticsEventName;
  eventVersion: string;
  eventAt: string;
  schema: {
    domain: 'search';
    version: '2.0.0';
  };
  source: 'web';
  context: {
    pagePath: string;
    pageUrl: string;
    referrer: string;
    userAgent: string;
    anonymousId: string;
    sessionId: string;
    locale: string;
    timezoneOffsetMinutes: number;
  };
  properties: SearchAnalyticsProperties;
}

const ANALYTICS_ENDPOINT = '/api/analytics/events';
const ANON_ID_STORAGE_KEY = 'tcb_anon_id';
const SESSION_ID_STORAGE_KEY = 'tcb_session_id';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function getAnonymousId(): string {
  if (typeof window === 'undefined') return 'server';

  try {
    const existing = window.localStorage.getItem(ANON_ID_STORAGE_KEY);
    if (existing) return existing;

    const created = generateId();
    window.localStorage.setItem(ANON_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return 'anonymous';
  }
}

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server-session';

  try {
    const existing = window.sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (existing) return existing;

    const created = generateId();
    window.sessionStorage.setItem(SESSION_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return 'session-anonymous';
  }
}

function normalizeProperties(properties: SearchAnalyticsProperties): SearchAnalyticsProperties {
  const queryTerms = properties.query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);

  return {
    ...properties,
    hasResults: properties.hasResults ?? (typeof properties.resultCount === 'number' ? properties.resultCount > 0 : undefined),
    queryTerms: properties.queryTerms ?? queryTerms,
  };
}

function createEnvelope(
  eventName: SearchAnalyticsEventName,
  properties: SearchAnalyticsProperties
): AnalyticsEventEnvelope {
  const normalizedProperties = normalizeProperties(properties);

  return {
    eventId: generateId(),
    eventName,
    eventVersion: '2.0.0',
    eventAt: new Date().toISOString(),
    schema: {
      domain: 'search',
      version: '2.0.0',
    },
    source: 'web',
    context: {
      pagePath: typeof window !== 'undefined' ? window.location.pathname : '/',
      pageUrl: typeof window !== 'undefined' ? window.location.href : '/',
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      anonymousId: getAnonymousId(),
      sessionId: getSessionId(),
      locale: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    },
    properties: normalizedProperties,
  };
}

export function trackSearchEvent(
  eventName: SearchAnalyticsEventName,
  properties: SearchAnalyticsProperties
): void {
  if (typeof window === 'undefined') return;

  const envelope = createEnvelope(eventName, properties);
  const body = JSON.stringify(envelope);

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
    return;
  }

  void fetch(ANALYTICS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Do not block UX for analytics transport failures.
  });
}
