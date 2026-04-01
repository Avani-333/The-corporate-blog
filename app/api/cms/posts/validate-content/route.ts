import { NextRequest, NextResponse } from 'next/server';
import { validateCMSData } from '@/lib/cms-mapping';
import { validatePostUniqueConstraints } from '@/lib/slug-validation';
import type { EditorState } from '@/lib/editor-state';

/**
 * POST /api/cms/posts/validate-content
 * Validate CMS editor state without saving
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const editorState = body.editorState as EditorState;
    const postId = body.postId as string | undefined;
    
    if (!editorState) {
      return NextResponse.json(
        { error: 'Editor state is required' },
        { status: 400 }
      );
    }

    // Validate CMS structure
    const cmsValidation = validateCMSData(editorState);

    // Validate unique constraints if title is present
    let uniqueValidation = null;
    if (editorState.post?.title) {
      uniqueValidation = await validatePostUniqueConstraints({
        title: editorState.post.title,
        slug: editorState.post.slug,
        postId,
      });
    }

    const isValid = cmsValidation.isValid && (uniqueValidation?.isValid ?? true);

    return NextResponse.json({
      success: true,
      data: {
        isValid,
        cmsValidation,
        uniqueValidation,
        suggestedSlug: uniqueValidation?.validatedData?.slug,
      },
    });

  } catch (error) {
    console.error('Error validating content:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}