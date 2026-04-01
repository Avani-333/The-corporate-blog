import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: {
    slug: string;
  };
}

/**
 * GET /api/r/:slug
 *
 * Affiliate redirect endpoint that:
 * 1. Finds the post by slug
 * 2. Verifies it has an affiliate link
 * 3. Tracks the click
 * 4. Redirects to the affiliate link
 *
 * Tracks:
 * - Click count (automatically via database)
 * - Referrer (HTTP_REFERER header)
 * - IP Address
 * - User Agent
 * - Country code (via Cloudflare headers if available)
 * - Device Type
 *
 * Usage: /api/r/my-post-slug
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = params;

  try {
    // Validate slug
    if (!slug || typeof slug !== 'string') {
      return NextResponse.json(
        { error: 'Invalid slug' },
        { status: 400 }
      );
    }

    // Find post by slug
    const post = await prisma.post.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        is_sponsored: true,
        affiliateLinkVia: true,
      },
    });

    // Post not found
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Post doesn't have affiliate link
    if (!post.affiliateLinkVia) {
      return NextResponse.json(
        { error: 'No affiliate link configured for this post' },
        { status: 400 }
      );
    }

    // Extract metadata from request
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || undefined;
    const referrer = request.headers.get('referer') || undefined;
    const countryCode = request.headers.get('cf-ipcountry') || undefined; // Cloudflare
    const deviceType = getDeviceType(userAgent || '');
    const userId = request.headers.get('x-user-id') || undefined; // Set by middleware if authenticated

    // Track the affiliate click
    try {
      await prisma.affiliateClick.create({
        data: {
          postId: post.id,
          postSlug: post.slug,
          referrer: referrer || null,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          countryCode: countryCode || null,
          deviceType: deviceType || null,
          userId: userId || null,
        },
      });
    } catch (error) {
      // Log but don't block redirect on tracking failure
      console.error(`[Affiliate] Failed to track click for post ${post.slug}:`, error);
    }

    // Redirect to affiliate link
    // Add query params for tracking (UTM parameters)
    const redirectUrl = new URL(post.affiliateLinkVia);
    redirectUrl.searchParams.append('utm_source', 'blog');
    redirectUrl.searchParams.append('utm_medium', 'affiliate');
    redirectUrl.searchParams.append('utm_campaign', post.slug);

    return NextResponse.redirect(redirectUrl.toString(), {
      status: 302, // Temporary redirect (can be changed by affiliate)
    });
  } catch (error) {
    console.error('[Affiliate] Redirect error:', error);

    return NextResponse.json(
      {
        error: 'Failed to process affiliate redirect',
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Extract client IP from request headers
 * Handles various proxy setups (Cloudflare, Vercel, etc.)
 */
function getClientIp(request: NextRequest): string | null {
  // Cloudflare
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  // Vercel
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  // Standard
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp;

  return null;
}

/**
 * Detect device type from user agent
 */
function getDeviceType(userAgent: string): string | null {
  if (!userAgent) return null;

  const ua = userAgent.toLowerCase();

  if (/mobile|android|iphone|ipod|phone/.test(ua)) {
    return 'mobile';
  }
  if (/ipad|tablet/.test(ua)) {
    return 'tablet';
  }
  if (/windows|macintosh|linux/.test(ua)) {
    return 'desktop';
  }

  return null;
}
