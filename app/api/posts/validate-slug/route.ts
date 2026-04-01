/**
 * POST /api/posts/validate-slug
 *
 * Accepts { slug, postId? } and returns availability + a suggestion if taken.
 * Used by the SlugPreview component for real-time slug validation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validatePostSlugUniqueness } from '@/lib/slug-validation';
import { withRateLimit, API_RATE_LIMIT } from '@/lib/security/rate-limit';

// ============================================================================
// VALIDATION
// ============================================================================

const schema = z.object({
  slug: z.string().min(1, 'Slug is required').max(100),
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

    const result = await validatePostSlugUniqueness(
      parsed.data.slug,
      parsed.data.postId
    );

    return NextResponse.json({
      success: true,
      data: {
        available: result.isValid,
        suggestion: result.isValid ? undefined : result.suggestedSlug,
        formatted: result.suggestedSlug || parsed.data.slug,
        errors: result.errors,
      },
      errors: [],
    });
  } catch (error) {
    console.error('POST /api/posts/validate-slug error:', error);
    return NextResponse.json(
      { success: false, errors: ['Failed to validate slug'] },
      { status: 500 }
    );
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const POST = withRateLimit(handlePost, API_RATE_LIMIT);
