'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

interface SponsorBadgeProps {
  /**
   * The link to redirect through
   */
  affiliateLinkVia: string;

  /**
   * Post slug for tracking
   */
  postSlug: string;

  /**
   * Optional sponsor name to display
   * Example: "Sponsored by Acme Corp"
   */
  sponsorName?: string;

  /**
   * Text for the call-to-action button
   * @default "Learn More"
   */
  ctaText?: string;

  /**
   * Size variant
   * @default "md"
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Hide the disclosure text
   * @default false
   */
  hideDisclosure?: boolean;

  /**
   * Custom className for the container
   */
  className?: string;
}

/**
 * Sponsor Badge Component
 *
 * Displays on sponsored posts with:
 * - "Sponsored" disclosure
 * - Call-to-action button
 * - Click tracking via /api/r/:slug endpoint
 *
 * Usage:
 * ```tsx
 * {post.is_sponsored && post.affiliateLinkVia && (
 *   <SponsorBadge
 *     affiliateLinkVia={post.affiliateLinkVia}
 *     postSlug={post.slug}
 *     sponsorName="Acme Corp"
 *     ctaText="Get Acme Product"
 *   />
 * )}
 * ```
 */
export function SponsorBadge({
  affiliateLinkVia,
  postSlug,
  sponsorName,
  ctaText = 'Learn More',
  size = 'md',
  hideDisclosure = false,
  className = '',
}: SponsorBadgeProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Use the affiliate redirect endpoint for tracking
      const response = await fetch(`/api/r/${postSlug}`, {
        method: 'GET',
        // The endpoint will handle redirect
      });

      // The browser will follow the redirect automatically
      // If we need to track before redirect, fetch will follow it
      if (response.redirected) {
        window.location.href = response.url;
      }
    } catch (error) {
      console.error('Failed to process affiliate link:', error);
      // Fallback to direct link
      window.location.href = affiliateLinkVia;
    } finally {
      setIsLoading(false);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <div
      className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}
      role="region"
      aria-label="Sponsored content"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          {!hideDisclosure && (
            <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">
              📌 Sponsored
            </p>
          )}
          {sponsorName && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Sponsored by {sponsorName}</span>
              <span className="text-gray-500 ml-2">
                We may earn a commission from purchases made through this link
              </span>
            </p>
          )}
        </div>

        <a
          href={affiliateLinkVia}
          onClick={handleClick}
          className={`
            inline-flex items-center justify-center gap-2
            bg-blue-600 text-white font-semibold rounded-lg
            hover:bg-blue-700 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            whitespace-nowrap
            ${sizeClasses[size]}
          `}
          disabled={isLoading}
          rel="noopener noreferrer"
          target="_blank"
        >
          {ctaText}
          <ArrowUpRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

/**
 * Minimal sponsor disclosure (inline)
 *
 * Usage in post header:
 * ```tsx
 * {post.is_sponsored && <SponsorDisclosure sponsorName="Acme Corp" />}
 * ```
 */
export function SponsorDisclosure({ sponsorName }: { sponsorName?: string }) {
  return (
    <span className="inline-block bg-yellow-50 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-yellow-200">
      {sponsorName ? `📌 Sponsored by ${sponsorName}` : '📌 Sponsored'}
    </span>
  );
}

/**
 * Sponsor banner for header/sidebar
 */
export function SponsorBanner({
  affiliateLinkVia,
  postSlug,
  sponsorName,
  sponsorDescription,
  sponsorLogo,
  className = '',
}: {
  affiliateLinkVia: string;
  postSlug: string;
  sponsorName: string;
  sponsorDescription?: string;
  sponsorLogo?: string;
  className?: string;
}) {
  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.location.href = `/api/r/${postSlug}`;
  };

  return (
    <a
      href={affiliateLinkVia}
      onClick={handleClick}
      className={`
        block bg-gradient-to-r from-blue-500 to-blue-600 
        text-white rounded-lg overflow-hidden
        transition-transform hover:scale-105 hover:shadow-lg
        ${className}
      `}
      rel="noopener noreferrer"
      target="_blank"
    >
      <div className="p-6">
        {sponsorLogo && (
          <img
            src={sponsorLogo}
            alt={sponsorName}
            className="h-8 mb-3 object-contain"
          />
        )}
        <h3 className="font-bold text-lg mb-2">{sponsorName}</h3>
        {sponsorDescription && (
          <p className="text-sm text-blue-100 mb-4">{sponsorDescription}</p>
        )}
        <span className="inline-flex items-center text-sm font-semibold">
          Learn More <ArrowUpRightIcon className="w-4 h-4 ml-2" />
        </span>
      </div>
    </a>
  );
}
