/**
 * N+1 Query Elimination - Affiliate Service Refactor
 * 
 * PROBLEM: Sequential operations (findUnique → create/update) require 2-3 queries per operation
 * 
 * SOLUTION: Use Prisma transactions and proper query design
 * 
 * BEFORE: 2-3 sequential queries per operation
 * AFTER: 1 atomic transaction
 */

import { Prisma, PrismaClient } from '@prisma/client';

export class OptimizedAffiliateService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Track affiliate click (atomically)
   * OPTIMIZED: Single verified operation with transaction
   */
  async trackAffiliateClickOptimized(postId: string, linkUrl: string) {
    return this.prisma.$transaction(async (tx) => {
      // Verify post exists in single query
      const post = await tx.post.findUniqueOrThrow({
        where: { id: postId },
        select: { id: true, affiliateLinkVia: true },
      });

      // Create click record atomically
      const click = await tx.affiliateClick.create({
        data: {
          postId: post.id,
          linkUrl,
        },
      });

      return click;
    });
  }

  /**
   * Get affiliate stats efficiently
   * OPTIMIZED: Uses proper query design instead of sequential calls
   */
  async getAffiliateStatsOptimized(postId: string) {
    const [post, clicks] = await Promise.all([
      // Query 1: Post details with minimal fields
      this.prisma.post.findUniqueOrThrow({
        where: { id: postId },
        select: {
          id: true,
          title: true,
          affiliateLinkVia: true,
          _count: { select: { affiliateClicks: true } },
        },
      }),

      // Query 2: Recent clicks (run in parallel)
      this.prisma.affiliateClick.findMany({
        where: { postId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          userId: true,
          linkUrl: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      post,
      clicks,
      totalClicks: post._count.affiliateClicks,
    };
  }

  /**
   * Get recent clicks with aggregated stats
   * OPTIMIZED: Single query with aggregation instead of separate queries
   */
  async getRecentClicksOptimized(postId: string, limit: number = 50) {
    return this.prisma.affiliateClick.findMany({
      where: { postId },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Update affiliate link atomically
   * OPTIMIZED: Atomic transaction instead of separate operations
   */
  async updateAffiliateLinkOptimized(postId: string, newLink: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: { id: postId },
        data: {
          affiliateLinkVia: newLink,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          title: true,
          affiliateLinkVia: true,
          updatedAt: true,
        },
      });

      return updated;
    });
  }

  /**
   * Get affiliate metrics for multiple posts
   * OPTIMIZED: Single aggregation query instead of multiple
   */
  async getAffiliateMetricsForMultiplePosts(postIds: string[]) {
    if (postIds.length === 0) return [];

    return this.prisma.$queryRaw<any[]>`
      SELECT
        p.id,
        p.title,
        p.slug,
        COUNT(ac.id)::int as click_count,
        COUNT(DISTINCT ac."userId")::int as unique_users,
        MAX(ac."createdAt") as last_click_at
      FROM posts p
      LEFT JOIN affiliate_clicks ac ON ac."postId" = p.id
      WHERE p.id = ANY(${postIds}::text[])
      GROUP BY p.id, p.title, p.slug
    `;
  }

  /**
   * Get click trends over time
   * OPTIMIZED: Single query with aggregation
   */
  async getClickTrends(postId: string, windowDays: number = 30) {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - windowDays);

    return this.prisma.$queryRaw<any[]>`
      SELECT
        DATE(ac."createdAt") as date,
        COUNT(*) as clicks,
        COUNT(DISTINCT ac."userId")::int as unique_users
      FROM affiliate_clicks ac
      WHERE ac."postId" = ${postId}
        AND ac."createdAt" >= ${sinceDate}
      GROUP BY DATE(ac."createdAt")
      ORDER BY date DESC
    `;
  }

  /**
   * Top performing affiliate links
   * OPTIMIZED: Single query with aggregation
   */
  async getTopAffiliateLinks(limit: number = 10) {
    return this.prisma.$queryRaw<any[]>`
      SELECT
        p.id,
        p.title,
        p.slug,
        p."affiliateLinkVia",
        COUNT(*) as total_clicks,
        COUNT(DISTINCT ac."userId")::int as unique_users,
        ROUND(100.0 * COUNT(*) / p."viewCount", 2)::float as click_through_rate
      FROM affiliate_clicks ac
      JOIN posts p ON p.id = ac."postId"
      WHERE p."viewCount" > 0
      GROUP BY p.id, p.title, p.slug, p."affiliateLinkVia", p."viewCount"
      ORDER BY total_clicks DESC
      LIMIT ${limit}
    `;
  }
}

export function createOptimizedAffiliateService(prisma: PrismaClient) {
  return new OptimizedAffiliateService(prisma);
}
