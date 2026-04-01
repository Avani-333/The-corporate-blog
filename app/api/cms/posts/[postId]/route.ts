import { NextRequest, NextResponse } from 'next/server';
import { loadPostForCMS, updatePostFromCMS } from '@/lib/cms-service';
import { validateCMSData } from '@/lib/cms-mapping';
import { z } from 'zod';

const updatePostSchema = z.object({
  editorState: z.object({
    post: z.object({
      title: z.string().min(1).max(200),
      slug: z.string().optional(),
      excerpt: z.string().max(300).optional(),
      status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']),
      categories: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
      featuredImageUrl: z.string().url().optional(),
      seo: z.object({
        metaTitle: z.string().max(60).optional(),
        metaDescription: z.string().max(160).optional(),
        canonicalUrl: z.string().url().optional(),
        structuredData: z.record(z.any()).optional(),
      }).strict().default({}),
      scheduledFor: z.string().datetime().optional(),
    }).strict(),
    content: z.array(z.any()).min(1),
    ui: z.object({
      selectedBlockId: z.string().nullable().default(null),
      isDirty: z.boolean().default(false),
    }).strict().default({}),
  }).strict(),
  publishNow: z.boolean().default(false),
}).strict();

/**
 * GET /api/cms/posts/[postId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { postId } = params;

    if (!z.string().uuid().safeParse(postId).success) {
      return NextResponse.json(
        { error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    const result = await loadPostForCMS(postId);

    if (!result.success) {
      const status = result.errors[0] === 'Post not found' ? 404 : 500;
      return NextResponse.json(
        { error: result.errors[0] || 'Failed to load post' },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });

  } catch (error) {
    console.error('Error loading post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/cms/posts/[postId]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { postId } = params;

    if (!z.string().uuid().safeParse(postId).success) {
      return NextResponse.json(
        { error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = updatePostSchema.parse(body);

    // Validate CMS data structure
    const cmsValidation = validateCMSData(validatedData.editorState);
    if (!cmsValidation.isValid) {
      return NextResponse.json(
        {
          error: 'Invalid CMS data',
          details: cmsValidation.errors,
          fieldErrors: cmsValidation.fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await updatePostFromCMS({
      postId,
      editorState: validatedData.editorState,
      publishNow: validatedData.publishNow,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to update post',
          details: result.errors,
          validationErrors: result.validationErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: validatedData.publishNow 
        ? 'Post updated and published successfully' 
        : 'Post updated successfully',
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

    console.error('Error updating post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}