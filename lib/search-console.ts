interface SearchConsoleSitemapContent {
  type?: string;
  submitted?: string;
  indexed?: string;
}

interface SearchConsoleSitemapEntry {
  path?: string;
  lastSubmitted?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  type?: string;
  lastDownloaded?: string;
  contents?: SearchConsoleSitemapContent[];
}

interface SearchConsoleSitemapsListResponse {
  sitemap?: SearchConsoleSitemapEntry[];
}

export interface SearchConsoleCoverageSnapshot {
  siteUrl: string;
  sitemapUrl: string;
  connected: boolean;
  submittedSitemaps: number;
  pendingSitemaps: number;
  totalSubmittedUrls: number;
  totalIndexedUrls: number;
  indexCoverageRatio: number;
  lastSubmitted?: string;
  lastDownloaded?: string;
  entries: SearchConsoleSitemapEntry[];
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSearchConsoleConfig() {
  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || '';
  const accessToken = process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN || '';
  const configured = Boolean(siteUrl && accessToken);

  return {
    configured,
    siteUrl,
    accessToken,
    sitemapUrl: `${(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')}/sitemap.xml`,
  };
}

function getAuthHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function submitSitemapToSearchConsole(sitemapUrl: string): Promise<void> {
  const siteUrl = getRequiredEnv('GOOGLE_SEARCH_CONSOLE_SITE_URL');
  const accessToken = getRequiredEnv('GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN');

  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: getAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Search Console sitemap submit failed (${response.status}): ${body || 'no response body'}`);
  }
}

export async function fetchCoverageSnapshot(): Promise<SearchConsoleCoverageSnapshot> {
  const siteUrl = getRequiredEnv('GOOGLE_SEARCH_CONSOLE_SITE_URL');
  const accessToken = getRequiredEnv('GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN');
  const sitemapUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')}/sitemap.xml`;

  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Search Console list sitemaps failed (${response.status}): ${body || 'no response body'}`);
  }

  const payload = (await response.json()) as SearchConsoleSitemapsListResponse;
  const entries = Array.isArray(payload.sitemap) ? payload.sitemap : [];

  let totalSubmittedUrls = 0;
  let totalIndexedUrls = 0;
  let pendingSitemaps = 0;
  let lastSubmitted = '';
  let lastDownloaded = '';

  entries.forEach((entry) => {
    if (entry.isPending) pendingSitemaps += 1;

    if (entry.lastSubmitted && (!lastSubmitted || entry.lastSubmitted > lastSubmitted)) {
      lastSubmitted = entry.lastSubmitted;
    }

    if (entry.lastDownloaded && (!lastDownloaded || entry.lastDownloaded > lastDownloaded)) {
      lastDownloaded = entry.lastDownloaded;
    }

    const contents = Array.isArray(entry.contents) ? entry.contents : [];
    contents.forEach((content) => {
      totalSubmittedUrls += Number(content.submitted || 0);
      totalIndexedUrls += Number(content.indexed || 0);
    });
  });

  const indexCoverageRatio = totalSubmittedUrls > 0 ? totalIndexedUrls / totalSubmittedUrls : 0;

  return {
    siteUrl,
    sitemapUrl,
    connected: true,
    submittedSitemaps: entries.length,
    pendingSitemaps,
    totalSubmittedUrls,
    totalIndexedUrls,
    indexCoverageRatio,
    lastSubmitted: lastSubmitted || undefined,
    lastDownloaded: lastDownloaded || undefined,
    entries,
  };
}
