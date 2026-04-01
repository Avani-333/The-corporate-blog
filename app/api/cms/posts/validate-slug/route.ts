import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSlugForCMS } from '@/lib/cms-service';

const slugValidationSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
  postId: z.string().uuid().optional(),
}).strict();

/**
 * POST /api/cms/posts/validate-slug
 * Real-time slug validation for CMS forms
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, postId } = slugValidationSchema.parse(body);

    const result = await validateSlugForCMS(slug, 'post', postId);

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error('Error validating slug:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}