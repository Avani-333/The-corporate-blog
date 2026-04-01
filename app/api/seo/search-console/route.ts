import { NextResponse } from 'next/server';
import { fetchCoverageSnapshot, getSearchConsoleConfig } from '@/lib/search-console';

export const revalidate = 0;

export async function GET() {
  try {
    const config = getSearchConsoleConfig();

    if (!config.configured) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          reason: 'Missing GOOGLE_SEARCH_CONSOLE_SITE_URL and/or GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN',
          siteUrl: config.siteUrl,
          sitemapUrl: config.sitemapUrl,
        },
      });
    }

    const snapshot = await fetchCoverageSnapshot();

    return NextResponse.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Search Console coverage fetch failed',
      },
      { status: 500 }
    );
  }
}
