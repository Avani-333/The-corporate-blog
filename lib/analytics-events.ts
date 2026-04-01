type AnalyticsDomain = 'navigation' | 'content' | 'search' | 'performance' | 'engagement';

interface BaseAnalyticsEvent {
  eventName: string;
  domain: AnalyticsDomain;
  properties: Record<string, unknown>;
}

interface PublishEventPayload {
  postId: string;
  status: 'PUBLISHED' | 'PENDING_REVIEW';
  slug: string;
  titleLength: number;
  wordCount: number;
  categoryCount: number;
  tagCount: number;
  hasFeaturedImage: boolean;
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

function sendInternalAnalyticsEvent({ eventName, domain, properties }: BaseAnalyticsEvent): void {
  if (typeof window === 'undefined') return;

  const payload = {
    eventId: generateId(),
    eventName,
    eventVersion: '1.0.0',
    eventAt: new Date().toISOString(),
    schema: {
      domain,
      version: '1.0.0',
    },
    source: 'web' as const,
    context: {
      pagePath: window.location.pathname,
      pageUrl: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      anonymousId: getAnonymousId(),
      sessionId: getSessionId(),
      locale: navigator.language,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    },
    properties,
  };

  const body = JSON.stringify(payload);

  if (typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(ANALYTICS_ENDPOINT, new Blob([body], { type: 'application/json' }));
    return;
  }

  void fetch(ANALYTICS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Never block UX because of analytics transport failures.
  });
}

function sendGaEvent(eventName: string, properties: Record<string, unknown>): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, properties);
}

export function trackPageView(path: string, url: string): void {
  sendGaEvent('page_view', {
    page_path: path,
    page_location: url,
    page_title: typeof document !== 'undefined' ? document.title : '',
  });

  sendInternalAnalyticsEvent({
    eventName: 'page_view',
    domain: 'navigation',
    properties: {
      path,
      url,
      title: typeof document !== 'undefined' ? document.title : '',
    },
  });
}

export function trackPublishEvent(payload: PublishEventPayload): void {
  const eventName = payload.status === 'PUBLISHED' ? 'post_published' : 'post_submitted_for_review';

  sendGaEvent(eventName, {
    post_id: payload.postId,
    post_slug: payload.slug,
    post_status: payload.status,
    word_count: payload.wordCount,
    category_count: payload.categoryCount,
    tag_count: payload.tagCount,
    has_featured_image: payload.hasFeaturedImage,
  });

  sendInternalAnalyticsEvent({
    eventName,
    domain: 'content',
    properties: payload,
  });
}
