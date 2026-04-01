import { NextRequest, NextResponse } from 'next/server';
import { getSearchConsoleConfig, submitSitemapToSearchConsole } from '@/lib/search-console';

export const revalidate = 0;

function isAuthorized(request: NextRequest): boolean {
  const adminToken = process.env.SEARCH_CONSOLE_ADMIN_TOKEN;
  if (!adminToken) return true;

  const provided = request.headers.get('x-admin-token') || '';
  return provided === adminToken;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = getSearchConsoleConfig();

    if (!config.configured) {
      return NextResponse.json(
        {
          success: false,
          error: 'Search Console is not configured. Missing required environment variables.',
        },
        { status: 400 }
      );
    }

    await submitSitemapToSearchConsole(config.sitemapUrl);

    return NextResponse.json({
      success: true,
      data: {
        submitted: true,
        siteUrl: config.siteUrl,
        sitemapUrl: config.sitemapUrl,
        submittedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sitemap submission failed',
      },
      { status: 500 }
    );
  }
}
