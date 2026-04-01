/**
 * POST /api/posts/generate-slug
 *
 * Accepts { title, postId? } and returns a unique, URL-safe slug.
 * Used by the SlugPreview component to auto-generate slugs as the user types.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateSlugFromTitle } from '@/lib/slug-validation';
import { withRateLimit, API_RATE_LIMIT } from '@/lib/security/rate-limit';

// ============================================================================
// VALIDATION
// ============================================================================

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  postId: z.string().optional(),
}).strict();

// ============================================================================
// HANDLER
// ============================================================================

async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }

    const slug = await generateSlugFromTitle(parsed.data.title, parsed.data.postId);

    return NextResponse.json({
      success: true,
      data: { slug },
      errors: [],
    });
  } catch (error) {
    console.error('POST /api/posts/generate-slug error:', error);
    return NextResponse.json(
      { success: false, errors: ['Failed to generate slug'] },
      { status: 500 }
    );
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const POST = withRateLimit(handlePost, API_RATE_LIMIT);
