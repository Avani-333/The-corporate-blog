'use client';

import { ReactNode } from 'react';
import { LinkIcon } from 'lucide-react';

interface AffiliateHighlightProps {
  /**
   * The URL of the affiliate link
   */
  href: string;

  /**
   * The link text to display
   */
  children: ReactNode;

  /**
   * Whether to show the affiliate badge
   * @default true
   */
  showBadge?: boolean;

  /**
   * The text for the badge
   * @default "affiliate"
   */
  badgeText?: string;

  /**
   * Post slug for tracking
   */
  postSlug?: string;

  /**
   * Custom className
   */
  className?: string;

  /**
   * Whether this is a sponsored link (owned by sponsor)
   * @default false
   */
  isSponsored?: boolean;
}

/**
 * Affiliate Link Component with Optional Badge
 *
 * Displays affiliate links with a visual badge to indicate
 * they are affiliate/sponsored content.
 *
 * When used with /api/r/:slug redirection:
 * 1. The link gets highlighted with a badge
 * 2. Clicks are tracked for analytics
 * 3. Disclosure is transparent to users
 *
 * Usage:
 * ```tsx
 * // In post content
 * <AffiliateHighlight
 *   href="https://example.com/product"
 *   postSlug="my-post"
 *   showBadge={true}
 * >
 *   Check out this awesome product
 * </AffiliateHighlight>
 *
 * // Or use with /api/r/:slug endpoint
 * <AffiliateHighlight
 *   href="/api/r/my-post"
 *   postSlug="my-post"
 *   showBadge={true}
 * >
 *   Click here
 * </AffiliateHighlight>
 * ```
 */
export function AffiliateHighlight({
  href,
  children,
  showBadge = true,
  badgeText = 'affiliate',
  postSlug,
  className = '',
  isSponsored = false,
}: AffiliateHighlightProps) {
  const badgeColor = isSponsored ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800';

  if (!showBadge) {
    return (
      <a
        href={href}
        className={`text-blue-600 hover:text-blue-800 underline transition-colors ${className}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <a
        href={href}
        className="text-blue-600 hover:text-blue-800 underline transition-colors"
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
      </a>
      <span
        className={`inline-block px-1.5 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap ${badgeColor}`}
        title="This is an affiliate link"
      >
        {badgeText}
      </span>
    </span>
  );
}

/**
 * Pre-configured Affiliate Link wrapper for post content
 *
 * Automatically uses the /api/r/:slug endpoint for tracking
 *
 * Usage in MDX or post content:
 * ```tsx
 * <PostAffiliateLink href="https://example.com" postSlug="my-post">
 *   Product Name
 * </PostAffiliateLink>
 * ```
 */
export function PostAffiliateLink({
  href,
  postSlug,
  children,
  showBadge = true,
}: {
  href: string;
  postSlug: string;
  children: ReactNode;
  showBadge?: boolean;
}) {
  // Use the /api/r/:slug redirect endpoint for tracking
  const trackingUrl = `/api/r/${postSlug}`;

  return (
    <AffiliateHighlight
      href={trackingUrl}
      postSlug={postSlug}
      showBadge={showBadge}
      badgeText="affiliate"
    >
      {children}
    </AffiliateHighlight>
  );
}

/**
 * Sponsored Link Badge
 *
 * For marking sponsor-exclusive content
 *
 * Usage:
 * ```tsx
 * <SponsoredLink href="..." postSlug="my-post">
 *   Exclusive Sponsor Offer
 * </SponsoredLink>
 * ```
 */
export function SponsoredLink({
  href,
  postSlug,
  children,
  showBadge = true,
}: {
  href: string;
  postSlug: string;
  children: ReactNode;
  showBadge?: boolean;
}) {
  const trackingUrl = `/api/r/${postSlug}`;

  return (
    <AffiliateHighlight
      href={trackingUrl}
      postSlug={postSlug}
      showBadge={showBadge}
      badgeText="Sponsored"
      isSponsored={true}
    >
      {children}
    </AffiliateHighlight>
  );
}
