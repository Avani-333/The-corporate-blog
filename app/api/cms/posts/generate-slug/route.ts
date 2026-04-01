import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateSlugForCMS, validateSlugForCMS } from '@/lib/cms-service';

const titleToSlugSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  postId: z.string().uuid().optional(),
}).strict();

/**
 * POST /api/cms/posts/generate-slug
 * Generate slug from title with validation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, postId } = titleToSlugSchema.parse(body);

    // Generate slug from title
    const slug = await generateSlugForCMS(title, 'post', postId);

    // Validate the generated slug
    const validation = await validateSlugForCMS(slug, 'post', postId);

    return NextResponse.json({
      success: true,
      data: {
        slug,
        validation,
      },
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

    console.error('Error generating slug:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}