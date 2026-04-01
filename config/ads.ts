/**
 * Centralized Ad Configuration
 *
 * Define all ad slots for the application here.
 * Makes it easy to manage ad placements, client IDs, and slot IDs.
 *
 * Usage:
 * ```tsx
 * import { AD_SLOTS } from '@/config/ads';
 *
 * <AdSlot {...AD_SLOTS.POST_CONTENT_1} />
 * ```
 */

import { AdSlotProps } from '@/components/ads';

export const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || '';

/**
 * Standard ad format dimensions
 * Reference: https://support.google.com/adsense/answer/6002575
 */
export const AD_DIMENSIONS = {
  // Horizontal formats
  LEADERBOARD: { width: 728, height: 90 } as const, // 728x90
  WIDE_SKYSCRAPER: { width: 160, height: 600 } as const, // 160x600
  HALF_PAGE: { width: 300, height: 600 } as const, // 300x600
  VERTICAL_RECTANGLE: { width: 240, height: 400 } as const, // 240x400
  SQUARE: { width: 250, height: 250 } as const, // 250x250
  RECTANGLE: { width: 300, height: 250 } as const, // 300x250
  MOBILE_BANNER: { width: 320, height: 50 } as const, // 320x50
  MOBILE_LARGE_BANNER: { width: 320, height: 100 } as const, // 320x100
} as const;

/**
 * Ad slot definitions for the entire site
 *
 * Each slot has:
 * - Unique ID across the site
 * - Type (adsense, direct, placeholder)
 * - Dimensions
 * - Optional Google AdSense slot ID
 * - Format (horizontal, vertical, auto)
 */
export const AD_SLOTS = {
  // ============================================================================
  // BLOG POST PAGE ADS
  // ============================================================================

  /**
   * Blog post inline ad after 2nd H2 heading
   * Primary monetization point in post content
   */
  POST_CONTENT_1: {
    id: 'post-content-1',
    type: 'adsense' as const,
    adClientId: ADSENSE_CLIENT_ID,
    adSlotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_POST_CONTENT_1 || 'post-content-1',
    format: 'horizontal' as const,
    ...AD_DIMENSIONS.LEADERBOARD,
  } satisfies AdSlotProps,

  /**
   * Blog post inline ad after 4th H2 heading
   * Secondary monetization point deeper in post
   */
  POST_CONTENT_2: {
    id: 'post-content-2',
    type: 'adsense' as const,
    adClientId: ADSENSE_CLIENT_ID,
    adSlotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_POST_CONTENT_2 || 'post-content-2',
    format: 'horizontal' as const,
    ...AD_DIMENSIONS.LEADERBOARD,
  } satisfies AdSlotProps,

  /**
   * Blog post sidebar ad - top
   * High-visibility sidebar placement
   */
  POST_SIDEBAR_1: {
    id: 'post-sidebar-1',
    type: 'adsense' as const,
    adClientId: ADSENSE_CLIENT_ID,
    adSlotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_POST_SIDEBAR_1 || 'post-sidebar-1',
    format: 'vertical' as const,
    ...AD_DIMENSIONS.RECTANGLE,
  } satisfies AdSlotProps,

  /**
   * Blog post sidebar ad - middle
   */
  POST_SIDEBAR_2: {
    id: 'post-sidebar-2',
    type: 'adsense' as const,
    adClientId: ADSENSE_CLIENT_ID,
    adSlotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_POST_SIDEBAR_2 || 'post-sidebar-2',
    format: 'vertical' as const,
    ...AD_DIMENSIONS.RECTANGLE,
  } satisfies AdSlotProps,

  /**
   * Blog post sidebar ad - bottom
   */
  POST_SIDEBAR_3: {
    id: 'post-sidebar-3',
    type: 'direct' as const, // Direct sponsor ad
    ...AD_DIMENSIONS.RECTANGLE,
  } satisfies AdSlotProps,

  // ============================================================================
  // BLOG LIST / ARCHIVE PAGE ADS
  // ============================================================================

  /**
   * Blog list page header banner
   */
  BLOG_LIST_HEADER: {
    id: 'blog-list-header',
    type: 'adsense' as const,
    adClientId: ADSENSE_CLIENT_ID,
    adSlotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BLOG_LIST_HEADER || 'blog-list-header',
    format: 'horizontal' as const,
    ...AD_DIMENSIONS.LEADERBOARD,
  } satisfies AdSlotProps,

  /**
   * Blog list page sidebar
   */
  BLOG_LIST_SIDEBAR: {
    id: 'blog-list-sidebar',
    type: 'adsense' as const,
    adClientId: ADSENSE_CLIENT_ID,
    adSlotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BLOG_LIST_SIDEBAR || 'blog-list-sidebar',
    format: 'vertical' as const,
    ...AD_DIMENSIONS.RECTANGLE,
  } satisfies AdSlotProps,

  // ============================================================================
  // HOMEPAGE ADS
  // ============================================================================

  /**
   * Homepage hero section banner
   */
  HOMEPAGE_HERO: {
    id: 'homepage-hero',
    type: 'direct' as const, // Usually sponsor banner
    ...AD_DIMENSIONS.LEADERBOARD,
  } satisfies AdSlotProps,

  /**
   * Homepage featured posts section
   */
  HOMEPAGE_FEATURED: {
    id: 'homepage-featured',
    type: 'adsense' as const,
    adClientId: ADSENSE_CLIENT_ID,
    adSlotId: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOMEPAGE_FEATURED || 'homepage-featured',
    format: 'horizontal' as const,
    ...AD_DIMENSIONS.LEADERBOARD,
  } satisfies AdSlotProps,

  // ============================================================================
  // DEVELOPMENT / TESTING ADS
  // ============================================================================

  /**
   * Placeholder for testing layouts
   * Use this for development without real ads
   */
  PLACEHOLDER_DEFAULT: {
    id: 'placeholder-default',
    type: 'placeholder' as const,
    ...AD_DIMENSIONS.RECTANGLE,
  } satisfies AdSlotProps,

  /**
   * Placeholder leaderboard (728x90)
   */
  PLACEHOLDER_LEADERBOARD: {
    id: 'placeholder-leaderboard',
    type: 'placeholder' as const,
    ...AD_DIMENSIONS.LEADERBOARD,
  } satisfies AdSlotProps,
} as const;

/**
 * Ad injection configuration for blog post pages
 * Controls where ads are inserted after H2 headings
 */
export const BLOG_POST_AD_INJECTIONS = [
  {
    /**
     * Inject first ad after the 2nd H2 heading
     * This typically gives readers time to engage with content first
     */
    injectAfterH2Index: 2,
    ...AD_SLOTS.POST_CONTENT_1,
  },
  {
    /**
     * Inject second ad after the 4th H2 heading
     * For longer posts with multiple sections
     */
    injectAfterH2Index: 4,
    ...AD_SLOTS.POST_CONTENT_2,
  },
] as const;

/**
 * Helper to get ad slot by ID
 *
 * Usage:
 * ```tsx
 * const adConfig = getAdSlotConfig('post-content-1');
 * ```
 */
export function getAdSlotConfig(slotId: keyof typeof AD_SLOTS): AdSlotProps {
  const slot = AD_SLOTS[slotId];
  if (!slot) {
    throw new Error(`Ad slot not found: ${slotId}`);
  }
  return slot as AdSlotProps;
}

/**
 * Get all sidebar ads for a page
 *
 * Usage:
 * ```tsx
 * const sidebarAds = getSidebarAds('post');
 * return sidebarAds.map(ad => <AdSlot key={ad.id} {...ad} />);
 * ```
 */
export function getSidebarAds(
  pageType: 'post' | 'blog-list' | 'homepage'
): AdSlotProps[] {
  const adMap: Record<string, AdSlotProps[]> = {
    post: [AD_SLOTS.POST_SIDEBAR_1, AD_SLOTS.POST_SIDEBAR_2, AD_SLOTS.POST_SIDEBAR_3],
    'blog-list': [AD_SLOTS.BLOG_LIST_SIDEBAR],
    homepage: [],
  };

  return adMap[pageType] || [];
}

/**
 * Verify all required environment variables are set
 * Call during app initialization to catch missing config early
 */
export function validateAdConfig(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!ADSENSE_CLIENT_ID) {
    errors.push(
      'Missing NEXT_PUBLIC_ADSENSE_CLIENT_ID. Google AdSense ads will not display.'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
