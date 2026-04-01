import prisma from '@/lib/prisma';

/**
 * Affiliate Click Analytics Service
 *
 * Provides utilities for:
 * - Getting affiliate click statistics
 * - Analyzing click sources
 * - Generating affiliate reports
 */

interface AffiliateStats {
  totalClicks: number;
  uniqueVisitors: number;
  clicksByCountry: Record<string, number>;
  clicksByDevice: Record<string, number>;
  clicksByReferrer: Record<string, number>;
  clicksLast7Days: number;
  clicksLast30Days: number;
  clicksToday: number;
  averageClicksPerDay: number;
}

interface AffiliateClickDetail {
  id: string;
  postSlug: string;
  referrer: string | null;
  country: string | null;
  deviceType: string | null;
  createdAt: Date;
}

/**
 * Get affiliate statistics for a post
 */
export async function getAffiliateStats(postSlug: string): Promise<AffiliateStats | null> {
  try {
    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { slug: postSlug },
      select: { id: true, is_sponsored: true, affiliateLinkVia: true },
    });

    if (!post?.affiliateLinkVia) {
      return null;
    }

    const postId = post.id;

    // Get all clicks for this post
    const clicks = await prisma.affiliateClick.findMany({
      where: { postId },
      select: {
        id: true,
        countryCode: true,
        deviceType: true,
        referrer: true,
        ipAddress: true,
        createdAt: true,
      },
    });

    if (clicks.length === 0) {
      return {
        totalClicks: 0,
        uniqueVisitors: 0,
        clicksByCountry: {},
        clicksByDevice: {},
        clicksByReferrer: {},
        clicksLast7Days: 0,
        clicksLast30Days: 0,
        clicksToday: 0,
        averageClicksPerDay: 0,
      };
    }

    // Calculate stats
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const clicksByCountry: Record<string, number> = {};
    const clicksByDevice: Record<string, number> = {};
    const clicksByReferrer: Record<string, number> = {};
    const uniqueIps = new Set<string>();

    let clicksLast7 = 0;
    let clicksLast30 = 0;
    let clicksToday = 0;

    clicks.forEach((click) => {
      // Country stats
      if (click.countryCode) {
        clicksByCountry[click.countryCode] =
          (clicksByCountry[click.countryCode] || 0) + 1;
      } else {
        clicksByCountry['Unknown'] = (clicksByCountry['Unknown'] || 0) + 1;
      }

      // Device stats
      const device = click.deviceType || 'Unknown';
      clicksByDevice[device] = (clicksByDevice[device] || 0) + 1;

      // Referrer stats (group by domain)
      if (click.referrer) {
        try {
          const refDomain = new URL(click.referrer).hostname;
          clicksByReferrer[refDomain] = (clicksByReferrer[refDomain] || 0) + 1;
        } catch {
          clicksByReferrer['Invalid'] = (clicksByReferrer['Invalid'] || 0) + 1;
        }
      } else {
        clicksByReferrer['Direct'] = (clicksByReferrer['Direct'] || 0) + 1;
      }

      // Unique visitors (by IP)
      if (click.ipAddress) {
        uniqueIps.add(click.ipAddress);
      }

      // Time-based stats
      if (click.createdAt >= sevenDaysAgo) {
        clicksLast7++;
      }
      if (click.createdAt >= thirtyDaysAgo) {
        clicksLast30++;
      }
      if (click.createdAt >= todayStart) {
        clicksToday++;
      }
    });

    // Calculate days since first click
    const firstClick = clicks.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )[0];
    const daysSinceFirstClick = Math.max(
      1,
      Math.floor((now.getTime() - firstClick.createdAt.getTime()) / (24 * 60 * 60 * 1000))
    );

    return {
      totalClicks: clicks.length,
      uniqueVisitors: uniqueIps.size,
      clicksByCountry,
      clicksByDevice,
      clicksByReferrer,
      clicksLast7Days: clicksLast7,
      clicksLast30Days: clicksLast30,
      clicksToday,
      averageClicksPerDay: Math.round(clicks.length / daysSinceFirstClick),
    };
  } catch (error) {
    console.error(`[Affiliate] Error getting stats for ${postSlug}:`, error);
    return null;
  }
}

/**
 * Get recent affiliate clicks for a post
 */
export async function getRecentAffiliateClicks(
  postSlug: string,
  limit: number = 50
): Promise<AffiliateClickDetail[]> {
  try {
    const post = await prisma.post.findUnique({
      where: { slug: postSlug },
      select: { id: true },
    });

    if (!post) {
      return [];
    }

    const clicks = await prisma.affiliateClick.findMany({
      where: { postId: post.id },
      select: {
        id: true,
        postSlug: true,
        referrer: true,
        countryCode: true,
        deviceType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return clicks.map((click) => ({
      id: click.id,
      postSlug: click.postSlug,
      referrer: click.referrer,
      country: click.countryCode,
      deviceType: click.deviceType,
      createdAt: click.createdAt,
    }));
  } catch (error) {
    console.error(`[Affiliate] Error getting recent clicks for ${postSlug}:`, error);
    return [];
  }
}

/**
 * Get affiliate statistics across all sponsored posts
 */
export async function getSponsoredPostsStats() {
  try {
    // Get all sponsored posts with affiliate links
    const sponsoredPosts = await prisma.post.findMany({
      where: {
        is_sponsored: true,
        affiliateLinkVia: { not: null },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        affiliateClicks: {
          select: { id: true, createdAt: true },
        },
      },
    });

    const stats = sponsoredPosts.map((post) => {
      const clicks = post.affiliateClicks;
      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const clicksLast30 = clicks.filter((c) => c.createdAt >= last30Days).length;

      return {
        slug: post.slug,
        title: post.title,
        totalClicks: clicks.length,
        clicksLast30Days: clicksLast30,
        lastClickDate: clicks.length > 0 ? clicks[0].createdAt : null,
      };
    });

    // Sort by total clicks descending
    return stats.sort((a, b) => b.totalClicks - a.totalClicks);
  } catch (error) {
    console.error('[Affiliate] Error getting sponsored posts stats:', error);
    return [];
  }
}

/**
 * Increment click count for analytics (alternative to creating records)
 * Can be used if you want lightweight click tracking
 */
export async function trackAffiliateClick(
  postSlug: string,
  metadata?: {
    referrer?: string;
    ipAddress?: string;
    userAgent?: string;
    countryCode?: string;
    deviceType?: string;
  }
) {
  try {
    const post = await prisma.post.findUnique({
      where: { slug: postSlug },
      select: { id: true, is_sponsored: true, affiliateLinkVia: true },
    });

    if (!post?.affiliateLinkVia) {
      return null;
    }

    return await prisma.affiliateClick.create({
      data: {
        postId: post.id,
        postSlug,
        referrer: metadata?.referrer || null,
        ipAddress: metadata?.ipAddress || null,
        userAgent: metadata?.userAgent || null,
        countryCode: metadata?.countryCode || null,
        deviceType: metadata?.deviceType || null,
      },
    });
  } catch (error) {
    console.error(`[Affiliate] Error tracking click for ${postSlug}:`, error);
    return null;
  }
}

/**
 * Get affiliate link for a post
 */
export async function getAffiliateLink(postSlug: string): Promise<string | null> {
  try {
    const post = await prisma.post.findUnique({
      where: { slug: postSlug },
      select: { affiliateLinkVia: true },
    });

    return post?.affiliateLinkVia || null;
  } catch {
    return null;
  }
}

/**
 * Update affiliate link for a sponsored post
 */
export async function updateAffiliateLink(
  postSlug: string,
  affiliateLinkVia: string
): Promise<boolean> {
  try {
    await prisma.post.update({
      where: { slug: postSlug },
      data: { affiliateLinkVia },
    });
    return true;
  } catch (error) {
    console.error(`[Affiliate] Error updating link for ${postSlug}:`, error);
    return false;
  }
}

/**
 * Mark a post as sponsored
 */
export async function markPostAsSponsored(
  postSlug: string,
  affiliateLinkVia: string
): Promise<boolean> {
  try {
    await prisma.post.update({
      where: { slug: postSlug },
      data: {
        is_sponsored: true,
        affiliateLinkVia,
      },
    });
    return true;
  } catch (error) {
    console.error(`[Affiliate] Error marking post as sponsored:`, error);
    return false;
  }
}

/**
 * Unmark a post as sponsored (removes affiliate link)
 */
export async function unmarkPostAsSponsored(postSlug: string): Promise<boolean> {
  try {
    await prisma.post.update({
      where: { slug: postSlug },
      data: {
        is_sponsored: false,
        affiliateLinkVia: null,
      },
    });
    return true;
  } catch (error) {
    console.error(`[Affiliate] Error unmarking post as sponsored:`, error);
    return false;
  }
}
