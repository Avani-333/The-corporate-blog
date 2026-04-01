/**
 * N+1 Query Elimination - Slug Validation Refactor
 * 
 * PROBLEM: generateUniquePostSlug() uses a while loop that calls findMany()
 * up to 100 times, resulting in 100+ sequential database queries
 * 
 * SOLUTION: Batch check all candidate slugs in a single query
 * 
 * BEFORE: 100 queries (in worst case)
 * AFTER: 1 query
 * 
 * Performance improvement: ~100x faster in worst case
 */

import { Prisma, PrismaClient } from '@prisma/client';

export class OptimizedSlugValidator {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate unique slug for posts
   * OPTIMIZED: Single batch query instead of loop with individual queries
   */
  async generateUniquePostSlug(baseSlug: string, excludePostId?: string): Promise<string> {
    // Generate first 100 candidate slugs
    const candidates = [baseSlug];
    for (let i = 1; i < 100; i++) {
      candidates.push(`${baseSlug}-${i}`);
    }

    // ✨ KEY OPTIMIZATION: Single query instead of 100 queries
    const existingSlugs = await this.prisma.post.findMany({
      where: {
        slug: { in: candidates },
        ...(excludePostId ? { id: { not: excludePostId } } : {}),
      },
      select: { slug: true },
    });

    const existingSet = new Set(existingSlugs.map(p => p.slug));

    // Find first available slug
    for (const candidate of candidates) {
      if (!existingSet.has(candidate)) {
        return candidate;
      }
    }

    // Fallback: use timestamp if all candidates are taken (extremely rare)
    return `${baseSlug}-${Date.now()}`;
  }

  /**
   * Generate unique slug for categories
   * Same pattern as post slug generation
   */
  async generateUniqueCategorySlug(baseSlug: string, excludeCategoryId?: string): Promise<string> {
    const candidates = [baseSlug];
    for (let i = 1; i < 100; i++) {
      candidates.push(`${baseSlug}-${i}`);
    }

    // ✨ Single batch query for all candidates
    const existingSlugs = await this.prisma.category.findMany({
      where: {
        slug: { in: candidates },
        ...(excludeCategoryId ? { id: { not: excludeCategoryId } } : {}),
      },
      select: { slug: true },
    });

    const existingSet = new Set(existingSlugs.map(c => c.slug));

    for (const candidate of candidates) {
      if (!existingSet.has(candidate)) {
        return candidate;
      }
    }

    return `${baseSlug}-${Date.now()}`;
  }

  /**
   * Generate unique slug for tags
   * Same batch pattern
   */
  async generateUniqueTagSlug(baseSlug: string, excludeTagId?: string): Promise<string> {
    const candidates = [baseSlug];
    for (let i = 1; i < 100; i++) {
      candidates.push(`${baseSlug}-${i}`);
    }

    const existingSlugs = await this.prisma.tag.findMany({
      where: {
        slug: { in: candidates },
        ...(excludeTagId ? { id: { not: excludeTagId } } : {}),
      },
      select: { slug: true },
    });

    const existingSet = new Set(existingSlugs.map(t => t.slug));

    for (const candidate of candidates) {
      if (!existingSet.has(candidate)) {
        return candidate;
      }
    }

    return `${baseSlug}-${Date.now()}`;
  }

  /**
   * Generate unique username for users
   * Same batch pattern
   */
  async generateUniqueUsername(baseUsername: string, excludeUserId?: string): Promise<string> {
    const candidates = [baseUsername];
    for (let i = 1; i < 100; i++) {
      candidates.push(`${baseUsername}${i}`);
    }

    const existingUsers = await this.prisma.user.findMany({
      where: {
        username: { in: candidates },
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { username: true },
    });

    const existingSet = new Set(existingUsers.map(u => u.username));

    for (const candidate of candidates) {
      if (!existingSet.has(candidate)) {
        return candidate;
      }
    }

    return `${baseUsername}${Date.now()}`;
  }

  /**
   * Validate post slug uniqueness
   * Direct optimization: single query instead of any loop
   */
  async validatePostSlugUniqueness(slug: string, excludePostId?: string): Promise<boolean> {
    const existing = await this.prisma.post.findFirst({
      where: {
        slug,
        ...(excludePostId ? { id: { not: excludePostId } } : {}),
      },
      select: { id: true },
    });

    return !existing;
  }

  /**
   * Validate category slug uniqueness
   */
  async validateCategorySlugUniqueness(slug: string, excludeCategoryId?: string): Promise<boolean> {
    const existing = await this.prisma.category.findFirst({
      where: {
        slug,
        ...(excludeCategoryId ? { id: { not: excludeCategoryId } } : {}),
      },
      select: { id: true },
    });

    return !existing;
  }

  /**
   * Validate tag slug uniqueness
   */
  async validateTagSlugUniqueness(slug: string, excludeTagId?: string): Promise<boolean> {
    const existing = await this.prisma.tag.findFirst({
      where: {
        slug,
        ...(excludeTagId ? { id: { not: excludeTagId } } : {}),
      },
      select: { id: true },
    });

    return !existing;
  }

  /**
   * Validate username uniqueness
   */
  async validateUsernameUniqueness(username: string, excludeUserId?: string): Promise<boolean> {
    const existing = await this.prisma.user.findFirst({
      where: {
        username,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });

    return !existing;
  }

  /**
   * Batch validate multiple slugs/usernames
   * Useful for bulk import operations
   */
  async validateMultipleSlugs(slugs: string[], type: 'post' | 'category' | 'tag'): Promise<Map<string, boolean>> {
    const model = type === 'post'
      ? this.prisma.post
      : type === 'category'
      ? this.prisma.category
      : this.prisma.tag;

    const existing = await model.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true },
    });

    const existingSet = new Set(existing.map(e => e.slug));
    const result = new Map<string, boolean>();

    for (const slug of slugs) {
      result.set(slug, !existingSet.has(slug));
    }

    return result;
  }
}

export function createOptimizedSlugValidator(prisma: PrismaClient) {
  return new OptimizedSlugValidator(prisma);
}
