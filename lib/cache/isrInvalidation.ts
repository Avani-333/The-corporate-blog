/**
 * ISR Cache Invalidation Utilities
 * Handles cache invalidation when posts are soft-deleted in Next.js ISR
 */

import { revalidatePath } from 'next/cache';

export interface CacheInvalidationOptions {
  postSlug: string;
  postId: string;
  authorSlug?: string;
  categorySlug?: string;
}

/**
 * Invalidate ISR cache for a soft-deleted post
 * Called when a post is soft-deleted to ensure the post page and related pages are revalidated
 */
export async function invalidatePostCache(
  options: CacheInvalidationOptions
): Promise<void> {
  try {
    // Invalidate the post detail page
    console.log(`[ISR] Invalidating post page: /blog/${options.postSlug}`);
    revalidatePath(`/blog/${options.postSlug}`, 'page');

    // Invalidate blog listing page
    console.log(`[ISR] Invalidating blog listing: /blog`);
    revalidatePath('/blog', 'page');

    // Invalidate category page if available
    if (options.categorySlug) {
      console.log(
        `[ISR] Invalidating category page: /categories/${options.categorySlug}`
      );
      revalidatePath(`/categories/${options.categorySlug}`, 'page');
    }

    // Invalidate author page if available
    if (options.authorSlug) {
      console.log(
        `[ISR] Invalidating author page: /authors/${options.authorSlug}`
      );
      revalidatePath(`/authors/${options.authorSlug}`, 'page');
    }

    // Invalidate home page (featured posts may change)
    console.log(`[ISR] Invalidating home page: /`);
    revalidatePath('/', 'page');

    // Invalidate search and related pages
    console.log(`[ISR] Invalidating search pages`);
    revalidatePath('/search', 'page');

    console.log(`[ISR] Cache invalidation completed for post: ${options.postId}`);
  } catch (error) {
    console.error('[ISR] Cache invalidation failed:', error);
    // Don't throw - log error and continue
    // The post is still soft-deleted even if cache invalidation fails
  }
}

/**
 * Invalidate ISR cache for a soft-deleted user
 * Called when a user is deleted to ensure author pages are revalidated
 */
export async function invalidateUserCache(options: {
  userId: string;
  userSlug?: string;
}): Promise<void> {
  try {
    if (options.userSlug) {
      console.log(
        `[ISR] Invalidating author page: /authors/${options.userSlug}`
      );
      revalidatePath(`/authors/${options.userSlug}`, 'page');
    }

    // Invalidate home page
    revalidatePath('/', 'page');
    console.log(`[ISR] Cache invalidation completed for user: ${options.userId}`);
  } catch (error) {
    console.error('[ISR] User cache invalidation failed:', error);
  }
}

/**
 * Perform bulk cache invalidation for multiple resources
 * Useful when migrating or bulk-deleting posts
 */
export async function invalidateBulkPostCache(postSlugs: string[]): Promise<void> {
  try {
    for (const slug of postSlugs) {
      revalidatePath(`/blog/${slug}`, 'page');
    }

    // Always invalidate listing pages after bulk operation
    revalidatePath('/blog', 'page');
    revalidatePath('/', 'page');
    revalidatePath('/search', 'page');

    console.log(`[ISR] Bulk cache invalidation completed for ${postSlugs.length} posts`);
  } catch (error) {
    console.error('[ISR] Bulk cache invalidation failed:', error);
  }
}

/**
 * Force complete cache revalidation
 * Use cautiously as this regenerates multiple pages
 */
export async function invalidateAllBlogCache(): Promise<void> {
  try {
    console.log('[ISR] Invalidating all blog-related caches');
    revalidatePath('/blog', 'layout');
    revalidatePath('/', 'layout');
    revalidatePath('/categories', 'layout');
    revalidatePath('/authors', 'layout');
    revalidatePath('/search', 'layout');
    console.log('[ISR] Complete blog cache invalidation completed');
  } catch (error) {
    console.error('[ISR] Complete cache invalidation failed:', error);
  }
}

/**
 * Check if post exists in cache (for monitoring)
 * Returns true if post page will be served from cache
 */
export function isPostCached(slug: string): boolean {
  // In real implementation, you'd check Next.js Data Cache structure
  // This is a placeholder for monitoring purposes
  return true; // Assume cached until proven otherwise
}

/**
 * Log cache invalidation event
 * Useful for debugging and monitoring
 */
export function logCacheInvalidation(
  event: 'post_deleted' | 'post_restored' | 'post_updated' | 'user_deleted',
  entityId: string,
  details?: Record<string, any>
): void {
  console.log(`[ISR_LOG] ${event}:`, {
    entityId,
    timestamp: new Date().toISOString(),
    ...details,
  });
}
