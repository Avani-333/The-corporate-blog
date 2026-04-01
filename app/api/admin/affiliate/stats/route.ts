import { NextRequest, NextResponse } from 'next/server';
import {
  getAffiliateStats,
  getRecentAffiliateClicks,
  getSponsoredPostsStats,
} from '@/lib/affiliate-service';

/**
 * GET /api/admin/affiliate/stats
 *
 * Get overall affiliate statistics (admin only)
 * 
 * Query params:
 * - slug: Get stats for specific post
 * - limit: Number of recent clicks to fetch (default: 50)
 * - recentDetails: true to include recent clicks
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Add auth check - verify user is admin/editor
    // const user = await getCurrentUser(request);
    // if (!user || user.role !== 'ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeRecent = searchParams.get('recentDetails') === 'true';

    // Single post stats
    if (slug) {
      const stats = await getAffiliateStats(slug);

      if (!stats) {
        return NextResponse.json(
          { error: 'Post not found or no affiliate link configured' },
          { status: 404 }
        );
      }

      const response: any = { data: stats };

      // Optionally include recent clicks
      if (includeRecent) {
        response.recentClicks = await getRecentAffiliateClicks(slug, limit);
      }

      return NextResponse.json(response);
    }

    // All sponsored posts stats
    const allStats = await getSponsoredPostsStats();

    return NextResponse.json({
      data: allStats,
      summary: {
        totalSponsored: allStats.length,
        totalClicks: allStats.reduce((sum, post) => sum + post.totalClicks, 0),
        clicksLast30Days: allStats.reduce((sum, post) => sum + post.clicksLast30Days, 0),
      },
    });
  } catch (error) {
    console.error('[Affiliate Admin] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch affiliate statistics',
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
