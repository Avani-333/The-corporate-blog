import { NextRequest, NextResponse } from 'next/server';
import {
  markPostAsSponsored,
  unmarkPostAsSponsored,
  updateAffiliateLink,
  getAffiliateLink,
} from '@/lib/affiliate-service';

/**
 * POST /api/admin/affiliate/manage
 *
 * Manage affiliate links for posts (admin only)
 *
 * Body:
 * {
 *   "action": "mark" | "unmark" | "update" | "get",
 *   "slug": "post-slug",
 *   "affiliateLinkVia": "https://example.com/affiliate?id=123" (required for mark/update)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Add auth check
    // const user = await getCurrentUser(request);
    // if (!user || user.role !== 'ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();
    const { action, slug, affiliateLinkVia } = body;

    // Validate inputs
    if (!action || !slug) {
      return NextResponse.json(
        { error: 'Missing required fields: action, slug' },
        { status: 400 }
      );
    }

    if (!['mark', 'unmark', 'update', 'get'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: mark, unmark, update, or get' },
        { status: 400 }
      );
    }

    // Validate affiliate link for actions that require it
    if (['mark', 'update'].includes(action) && !affiliateLinkVia) {
      return NextResponse.json(
        { error: 'affiliateLinkVia is required for this action' },
        { status: 400 }
      );
    }

    // Validate URL format if provided
    if (affiliateLinkVia) {
      try {
        new URL(affiliateLinkVia);
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format for affiliateLinkVia' },
          { status: 400 }
        );
      }
    }

    let result;

    switch (action) {
      case 'mark': {
        result = await markPostAsSponsored(slug, affiliateLinkVia);
        if (!result) {
          return NextResponse.json(
            { error: 'Failed to mark post as sponsored (post may not exist)' },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          message: `Post "${slug}" marked as sponsored`,
          data: { slug, is_sponsored: true, affiliateLinkVia },
        });
      }

      case 'unmark': {
        result = await unmarkPostAsSponsored(slug);
        if (!result) {
          return NextResponse.json(
            { error: 'Failed to unmark post as sponsored' },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          message: `Post "${slug}" unmarked as sponsored`,
          data: { slug, is_sponsored: false, affiliateLinkVia: null },
        });
      }

      case 'update': {
        result = await updateAffiliateLink(slug, affiliateLinkVia);
        if (!result) {
          return NextResponse.json(
            { error: 'Failed to update affiliate link' },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          message: `Affiliate link updated for "${slug}"`,
          data: { slug, affiliateLinkVia },
        });
      }

      case 'get': {
        const link = await getAffiliateLink(slug);
        if (!link) {
          return NextResponse.json(
            {
              success: true,
              data: { slug, has_affiliate_link: false, affiliateLinkVia: null },
            }
          );
        }
        return NextResponse.json({
          success: true,
          data: { slug, has_affiliate_link: true, affiliateLinkVia: link },
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Affiliate Manager] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to process affiliate management request',
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
