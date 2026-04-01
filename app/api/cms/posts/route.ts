import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  createPostFromCMS,
  updatePostFromCMS,
  loadPostForCMS
} from '@/lib/cms-service';
import { validateCMSData } from '@/lib/cms-mapping';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createPostSchema = z.object({
  editorState: z.object({
    post: z.object({
      title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
      slug: z.string().optional(),
      excerpt: z.string().max(300, 'Excerpt must be less than 300 characters').optional(),
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
    content: z.array(z.any()).min(1, 'Content is required'),
    ui: z.object({
      selectedBlockId: z.string().nullable().default(null),
      isDirty: z.boolean().default(false),
    }).strict().default({}),
  }).strict(),
  publishNow: z.boolean().default(false),
}).strict();

const updatePostSchema = z.object({
  postId: z.string().uuid('Invalid post ID'),
  editorState: createPostSchema.shape.editorState,
  publishNow: z.boolean().default(false),
});


// ============================================================================
// POST ENDPOINTS
// ============================================================================

/**
 * GET /api/cms/posts/[postId]
 * Load post for CMS editing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { postId } = params;

    if (!postId || !z.string().uuid().safeParse(postId).success) {
      return NextResponse.json(
        { error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    const result = await loadPostForCMS(postId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.errors[0] || 'Failed to load post' },
        { status: result.errors[0] === 'Post not found' ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });

  } catch (error) {
    console.error('Error in GET /api/cms/posts/[postId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cms/posts
 * Create new post from CMS
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication check here
    const authorId = request.headers.get('x-user-id'); // Replace with actual auth
    
    if (!authorId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createPostSchema.parse(body);

    // Additional CMS data validation
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

    const result = await createPostFromCMS({
      editorState: validatedData.editorState,
      authorId,
      publishNow: validatedData.publishNow,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to create post',
          details: result.errors,
          validationErrors: result.validationErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: validatedData.publishNow ? 'Post created and published successfully' : 'Post created as draft',
    }, { status: 201 });

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

    console.error('Error in POST /api/cms/posts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/cms/posts/[postId]
 * Update existing post from CMS
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    // TODO: Add authentication and authorization checks
    const { postId } = params;

    if (!postId || !z.string().uuid().safeParse(postId).success) {
      return NextResponse.json(
        { error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = updatePostSchema.parse({
      ...body,
      postId,
    });

    // Additional CMS data validation
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

    const result = await updatePostFromCMS(validatedData);

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
      message: validatedData.publishNow ? 'Post updated and published successfully' : 'Post updated successfully',
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

    console.error('Error in PUT /api/cms/posts/[postId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

