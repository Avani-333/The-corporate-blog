/**
 * EXAMPLE: Complete Blog Post Integration with Ad System
 *
 * This file demonstrates how to use the ad system in a real blog post page.
 * Copy patterns from here to implement ads in your own components.
 *
 * Files referenced:
 * - @/components/ads/AdSlot.tsx - Main ad component
 * - @/hooks/useAdScript.ts - Script loading hook
 * - @/lib/ad-injection.ts - Utilities for dynamic injection
 * - @/config/ads.ts - Centralized ad configuration
 */

'use client';

import { useEffect } from 'react';
import { AdSlot } from '@/components/ads';
import { injectAdAfterH2, reinitializeAds, findH2Headings } from '@/lib/ad-injection';
import { AD_SLOTS, BLOG_POST_AD_INJECTIONS, validateAdConfig } from '@/config/ads';

interface BlogPostExampleProps {
  postId: string;
  slug: string;
  title: string;
  content: string; // HTML or React nodes
  sidebar?: boolean;
}

/**
 * APPROACH 1: Using Static <AdSlot /> Components
 *
 * Best for:
 * - Next.js App Router with server components
 * - Predictable content structure
 * - Easy to position ads
 *
 * Example:
 * ```tsx
 * <BlogPostStaticAds slug="my-post" />
 * ```
 */
export function BlogPostStaticAds({ slug }: { slug: string }) {
  return (
    <article className="max-w-4xl mx-auto py-8">
      <h1>Blog Post Title</h1>
      <p>Introduction paragraph...</p>

      <h2>First Section</h2>
      <p>Section content...</p>

      <h2>Second Section</h2>
      <p>More content...</p>

      {/* Ad after 2nd H2 */}
      <AdSlot {...AD_SLOTS.POST_CONTENT_1} />

      <h2>Third Section</h2>
      <p>Even more content...</p>

      <h2>Fourth Section</h2>
      <p>Lots of content...</p>

      {/* Ad after 4th H2 */}
      <AdSlot {...AD_SLOTS.POST_CONTENT_2} />

      <h2>Conclusion</h2>
      <p>Summary paragraph...</p>
    </article>
  );
}

/**
 * APPROACH 2: Using Dynamic Ad Injection
 *
 * Best for:
 * - MDX content
 * - User-generated content
 * - Dynamic/unknown structure
 *
 * Example:
 * ```tsx
 * <BlogPostDynamicAds content={mdxContent} />
 * ```
 */
export function BlogPostDynamicAds({ content }: { content: React.ReactNode }) {
  useEffect(() => {
    // Wait for DOM to be ready
    const timer = setTimeout(() => {
      // Log found H2s for debugging
      const h2s = findH2Headings();
      console.log(`Found ${h2s.length} H2 headings:`, h2s);

      // Inject ads from configuration
      BLOG_POST_AD_INJECTIONS.forEach((config) => {
        const result = injectAdAfterH2({
          ...config,
          // Remove the injectAfterH2Index from spread for type safety
          adSlotId: config.id,
          injectAfterH2Index: config.injectAfterH2Index,
        });

        if (result) {
          console.log(`✓ Injected ad after H2 #${config.injectAfterH2Index}`);
        } else {
          console.warn(`✗ Failed to inject ad after H2 #${config.injectAfterH2Index}`);
        }
      });

      // Tell Google AdSense to find new ad units
      reinitializeAds();
    }, 100); // Small delay to ensure DOM is ready

    return () => clearTimeout(timer);
  }, [content]);

  return <article className="max-w-4xl mx-auto py-8">{content}</article>;
}

/**
 * APPROACH 3: Complete Blog Post with Sidebar
 *
 * Best for:
 * - Production blog pages
 * - Multiple ad placements
 * - Responsive layout
 *
 * Usage:
 * ```tsx
 * <BlogPostComplete
 *   postId="123"
 *   slug="my-article"
 *   title="My Article"
 *   content={<MDXContent />}
 * />
 * ```
 */
export function BlogPostComplete({
  postId,
  slug,
  title,
  content,
  sidebar = true,
}: BlogPostExampleProps) {
  useEffect(() => {
    // Validate ad configuration on mount
    const config = validateAdConfig();
    if (!config.isValid) {
      console.warn('Ad Configuration Issues:', config.errors);
    }
  }, []);

  useEffect(() => {
    // Wait for content to render, then inject ads
    const timer = setTimeout(() => {
      BLOG_POST_AD_INJECTIONS.forEach((config) => {
        injectAdAfterH2({
          ...config,
          adSlotId: config.id,
          injectAfterH2Index: config.injectAfterH2Index,
        });
      });

      reinitializeAds();
    }, 200);

    return () => clearTimeout(timer);
  }, [slug, content]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <article className="lg:col-span-2">
          <header className="mb-8">
            <h1 className="text-4xl font-bold mb-4">{title}</h1>
            <div className="flex items-center gap-4 text-gray-600">
              <span>By Admin</span>
              <span>•</span>
              <time dateTime={new Date().toISOString()}>
                {new Date().toLocaleDateString()}
              </time>
            </div>
          </header>

          {/* Content with injected ads */}
          <div className="prose prose-lg max-w-none">{content}</div>

          {/* Bottom of post ad */}
          <div className="mt-12 pt-8 border-t">
            <AdSlot
              {...AD_SLOTS.POST_CONTENT_1}
              onAdLoad={() => console.log('Post bottom ad loaded')}
              onAdError={() => console.log('Post bottom ad failed')}
            />
          </div>
        </article>

        {/* Sidebar */}
        {sidebar && (
          <aside className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Sidebar Ad 1 */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <AdSlot {...AD_SLOTS.POST_SIDEBAR_1} />
              </div>

              {/* Related Posts Widget */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Related Articles</h3>
                <ul className="space-y-3">
                  <li>
                    <a href="#" className="text-blue-600 hover:underline">
                      Related Article 1
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-blue-600 hover:underline">
                      Related Article 2
                    </a>
                  </li>
                </ul>
              </div>

              {/* Sidebar Ad 2 */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <AdSlot {...AD_SLOTS.POST_SIDEBAR_2} />
              </div>

              {/* Newsletter Signup */}
              <div className="bg-blue-50 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-2">Subscribe to Updates</h3>
                <form className="space-y-3">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 border rounded"
                  />
                  <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                    Subscribe
                  </button>
                </form>
              </div>

              {/* Sidebar Ad 3 (Direct sponsor) */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <AdSlot {...AD_SLOTS.POST_SIDEBAR_3} />
              </div>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}

/**
 * APPROACH 4: Responsive Mobile-First
 *
 * For mobile devices, use different ad sizes
 */
export function BlogPostMobileResponsive({ content }: { content: React.ReactNode }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <article className="max-w-4xl mx-auto py-8">
      {/* Content */}
      {content}

      {/* Responsive ads */}
      {isMobile ? (
        // Mobile: Smaller ads
        <AdSlot
          id="post-mobile-1"
          type="adsense"
          adClientId={AD_SLOTS.POST_CONTENT_1.adClientId}
          adSlotId={AD_SLOTS.POST_CONTENT_1.adSlotId}
          format="auto"
          width={300}
          height={250}
        />
      ) : (
        // Desktop: Larger ads
        <AdSlot {...AD_SLOTS.POST_CONTENT_1} />
      )}
    </article>
  );
}

/**
 * APPROACH 5: A/B Testing (Conditional Ads)
 *
 * Test different ad strategies
 */
export function BlogPostABTest({ content, variant }: { content: React.ReactNode; variant: 'a' | 'b' }) {
  return (
    <article className="max-w-4xl mx-auto py-8">
      {content}

      {/* Variant A: Single large banner */}
      {variant === 'a' && <AdSlot {...AD_SLOTS.POST_CONTENT_1} />}

      {/* Variant B: Multiple smaller ads */}
      {variant === 'b' && (
        <div className="space-y-6">
          <AdSlot
            id="variant-b-1"
            type="adsense"
            adClientId={AD_SLOTS.POST_CONTENT_1.adClientId}
            adSlotId={AD_SLOTS.POST_CONTENT_1.adSlotId}
            format="auto"
            width={300}
            height={250}
          />
          <AdSlot
            id="variant-b-2"
            type="adsense"
            adClientId={AD_SLOTS.POST_CONTENT_1.adClientId}
            adSlotId={AD_SLOTS.POST_CONTENT_1.adSlotId}
            format="auto"
            width={300}
            height={250}
          />
        </div>
      )}
    </article>
  );
}

/**
 * APPROACH 6: Error Boundary with Ad Fallbacks
 *
 * Graceful degradation if ads fail
 */
export function BlogPostWithFallback({ content }: { content: React.ReactNode }) {
  return (
    <article className="max-w-4xl mx-auto py-8">
      {content}

      <AdSlot
        {...AD_SLOTS.POST_CONTENT_1}
        onAdError={() => {
          // If ad fails, show alternative content
          console.log('Ad failed, showing fallback...');
        }}
      />

      {/* Fallback if needed */}
      <div className="bg-gray-50 rounded-lg p-6 mt-8 border border-gray-200">
        <h3 className="font-semibold mb-2">Interested in sponsoring?</h3>
        <p className="text-sm text-gray-600">
          Contact us for direct advertising opportunities on this blog.
        </p>
      </div>
    </article>
  );
}

/**
 * ADVANCED: Custom Hook for Blog Posts
 *
 * Encapsulates all ad logic
 */
export function useBlogPostAds(slug: string) {
  useEffect(() => {
    const timer = setTimeout(() => {
      // Find H2s
      const h2s = findH2Headings();

      // Inject ads
      BLOG_POST_AD_INJECTIONS.forEach((config) => {
        if (h2s.length >= config.injectAfterH2Index) {
          injectAdAfterH2({
            ...config,
            adSlotId: config.id,
            injectAfterH2Index: config.injectAfterH2Index,
          });
        }
      });

      // Reinitialize
      reinitializeAds();
    }, 200);

    return () => clearTimeout(timer);
  }, [slug]);

  return {
    adSlots: AD_SLOTS,
    validate: validateAdConfig,
  };
}

/**
 * Usage example:
 *
 * export function MyBlogPost() {
 *   const { adSlots } = useBlogPostAds('my-slug');
 *
 *   return (
 *     <article>
 *       <h1>My Post</h1>
 *       // Content automatically gets ads injected
 *     </article>
 *   );
 * }
 */
