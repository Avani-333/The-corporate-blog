import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { 
  mapCMSToPost, 
  mapPostToCMS, 
  mapCMSToCategory, 
  mapCMSToTag,
  updatePostCategories,
  updatePostTags,
  convertContentToHTML,
  validateCMSData,
  ContentValidationResult
} from '@/lib/cms-mapping';
import {
  logDraftCreated,
  logDraftUpdated,
  logDraftPublished,
  logDraftStatusChanged,
  logDraftError,
  logDraftValidationFailed,
} from '@/lib/draft-logger';
import {
  validatePostUniqueConstraints,
  validateCategoryUniqueConstraints,
  validateTagUniqueConstraints,
  generateSlugFromTitle,
  checkSlugAvailability
} from '@/lib/slug-validation';
import { 
  PostWithRelations, 
  CategoryWithRelations, 
  TagWithRelations,
  PostSummary 
} from '@/lib/database';
import type { EditorState } from '@/types/blocks';

// ============================================================================
// POST CMS OPERATIONS
// ============================================================================

export interface CreatePostData {
  editorState: EditorState;
  authorId: string;
  publishNow?: boolean;
}

export interface UpdatePostData {
  postId: string;
  editorState: EditorState;
  publishNow?: boolean;
}

export interface PostCMSResult {
  success: boolean;
  data?: PostWithRelations;
  errors: string[];
  validationErrors?: ContentValidationResult;
}

/**
 * Creates a new post from CMS editor state
 */
export async function createPostFromCMS(data: CreatePostData): Promise<PostCMSResult> {
  const errors: string[] = [];

  try {
    // Validate CMS data structure
    const validation = validateCMSData(data.editorState);
    if (!validation.isValid) {
      return {
        success: false,
        errors: ['Invalid CMS data structure'],
        validationErrors: validation,
      };
    }

    // Validate unique constraints (title/slug)
    const uniqueValidation = await validatePostUniqueConstraints({
      title: data.editorState.post.title,
      slug: data.editorState.post.slug,
    });

    if (!uniqueValidation.isValid) {
      errors.push(...uniqueValidation.errors);
    }

    // Map CMS data to Prisma format
    const postData = mapCMSToPost(data.editorState);
    
    // Add author and publication status
    postData.authorId = data.authorId;
    if (data.publishNow && postData.status === 'DRAFT') {
      postData.status = 'PUBLISHED';
      postData.publishedAt = new Date();
    }

    // Use validated slug
    postData.slug = uniqueValidation.validatedData.slug;

    // Convert content blocks to HTML for storage
    postData.contentHtml = convertContentToHTML(data.editorState.content);

    // Start database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the post
      const createdPost = await tx.post.create({
        data: postData,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              role: true,
            },
          },
          categories: {
            include: {
              category: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
        },
      });

      // Update categories
      if (data.editorState.post.categories.length > 0) {
        await updatePostCategories(tx, createdPost.id, data.editorState.post.categories);
      }

      // Update tags
      if (data.editorState.post.tags.length > 0) {
        await updatePostTags(tx, createdPost.id, data.editorState.post.tags);
      }

      // Retrieve updated post with all relations
      const updatedPost = await tx.post.findUnique({
        where: { id: createdPost.id },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              role: true,
            },
          },
          categories: {
            include: {
              category: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
        },
      });

      return updatedPost;
    });

    // Log draft creation
    if (result) {
      if (postData.status === 'PUBLISHED') {
        logDraftPublished({
          postId: result.id,
          userId: data.authorId,
          slug: postData.slug,
          title: postData.title,
          source: 'cms',
        });
      } else {
        logDraftCreated({
          postId: result.id,
          userId: data.authorId,
          slug: postData.slug,
          title: postData.title,
          source: 'cms',
        });
      }
    }

    return {
      success: true,
      data: result as PostWithRelations,
      errors,
    };

  } catch (error) {
    console.error('Error creating post from CMS:', error);
    logDraftError({
      operation: 'DRAFT_CREATED',
      userId: data.authorId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      source: 'cms',
    });
    return {
      success: false,
      errors: [`Failed to create post: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Updates an existing post from CMS editor state
 */
export async function updatePostFromCMS(data: UpdatePostData): Promise<PostCMSResult> {
  const errors: string[] = [];

  try {
    // Check if post exists
    const existingPost = await prisma.post.findUnique({
      where: { id: data.postId },
      select: { id: true, authorId: true, status: true },
    });

    if (!existingPost) {
      return {
        success: false,
        errors: ['Post not found'],
      };
    }

    // Validate CMS data structure
    const validation = validateCMSData(data.editorState);
    if (!validation.isValid) {
      return {
        success: false,
        errors: ['Invalid CMS data structure'],
        validationErrors: validation,
      };
    }

    // Validate unique constraints (exclude current post)
    const uniqueValidation = await validatePostUniqueConstraints({
      title: data.editorState.post.title,
      slug: data.editorState.post.slug,
      postId: data.postId,
    });

    if (!uniqueValidation.isValid) {
      errors.push(...uniqueValidation.errors);
    }

    // Map CMS data to Prisma format
    const postData = mapCMSToPost(data.editorState);
    
    // Handle publication
    if (data.publishNow && existingPost.status === 'DRAFT') {
      postData.status = 'PUBLISHED';
      postData.publishedAt = new Date();
    }

    // Use validated slug
    postData.slug = uniqueValidation.validatedData.slug;

    // Convert content blocks to HTML for storage
    postData.contentHtml = convertContentToHTML(data.editorState.content);

    // Remove fields that shouldn't be updated this way
    delete postData.authorId;

    // Start database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the post
      const updatedPost = await tx.post.update({
        where: { id: data.postId },
        data: postData,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              role: true,
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });

      // Update categories
      await updatePostCategories(tx, data.postId, data.editorState.post.categories);

      // Update tags
      await updatePostTags(tx, data.postId, data.editorState.post.tags);

      // Retrieve updated post with fresh relations
      const refreshedPost = await tx.post.findUnique({
        where: { id: data.postId },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              role: true,
            },
          },
          categories: {
            include: {
              category: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
        },
      });

      return refreshedPost;
    });

    // Log draft update
    if (result) {
      if (data.publishNow && existingPost.status === 'DRAFT') {
        logDraftPublished({
          postId: data.postId,
          userId: existingPost.authorId,
          slug: postData.slug,
          title: postData.title,
          source: 'cms',
        });
      } else if (postData.status !== existingPost.status) {
        logDraftStatusChanged({
          postId: data.postId,
          userId: existingPost.authorId,
          previousStatus: existingPost.status,
          newStatus: postData.status || existingPost.status,
          slug: postData.slug,
          source: 'cms',
        });
      } else {
        logDraftUpdated({
          postId: data.postId,
          userId: existingPost.authorId,
          slug: postData.slug,
          title: postData.title,
          contentBlockCount: data.editorState.content?.length,
          source: 'cms',
        });
      }
    }

    return {
      success: true,
      data: result as PostWithRelations,
      errors,
    };

  } catch (error) {
    console.error('Error updating post from CMS:', error);
    logDraftError({
      operation: 'DRAFT_UPDATED',
      postId: data.postId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      source: 'cms',
    });
    return {
      success: false,
      errors: [`Failed to update post: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Loads a post into CMS editor format
 */
export async function loadPostForCMS(postId: string): Promise<{
  success: boolean;
  data?: EditorState;
  errors: string[];
}> {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!post) {
      return {
        success: false,
        errors: ['Post not found'],
      };
    }

    const editorState = mapPostToCMS(post as any);

    return {
      success: true,
      data: editorState,
      errors: [],
    };

  } catch (error) {
    console.error('Error loading post for CMS:', error);
    return {
      success: false,
      errors: [`Failed to load post: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

// ============================================================================
// CATEGORY CMS OPERATIONS
// ============================================================================

export interface CreateCategoryData {
  name: string;
  slug?: string;
  description?: string;
  color?: string;
  parentId?: string;
}

/**
 * Creates a new category with validation
 */
export async function createCategoryFromCMS(data: CreateCategoryData): Promise<{
  success: boolean;
  data?: CategoryWithRelations;
  errors: string[];
}> {
  try {
    // Validate unique constraints
    const validation = await validateCategoryUniqueConstraints({
      name: data.name,
      slug: data.slug,
    });

    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    const categoryData = mapCMSToCategory({
      name: data.name,
      slug: validation.validatedData.slug,
      description: data.description || '',
      color: data.color || '#3B82F6',
      parentId: data.parentId,
    });

    const category = await prisma.category.create({
      data: categoryData,
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    return {
      success: true,
      data: category as CategoryWithRelations,
      errors: [],
    };

  } catch (error) {
    console.error('Error creating category:', error);
    return {
      success: false,
      errors: [`Failed to create category: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

// ============================================================================
// TAG CMS OPERATIONS
// ============================================================================

export interface CreateTagData {
  name: string;
  slug?: string;
  description?: string;
  color?: string;
}

/**
 * Creates a new tag with validation
 */
export async function createTagFromCMS(data: CreateTagData): Promise<{
  success: boolean;
  data?: TagWithRelations;
  errors: string[];
}> {
  try {
    // Validate unique constraints
    const validation = await validateTagUniqueConstraints({
      name: data.name,
      slug: data.slug,
    });

    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    const tagData = mapCMSToTag({
      name: data.name,
      slug: validation.validatedData.slug,
      description: data.description || '',
      color: data.color || '#10B981',
    });

    const tag = await prisma.tag.create({
      data: tagData,
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    return {
      success: true,
      data: tag as TagWithRelations,
      errors: [],
    };

  } catch (error) {
    console.error('Error creating tag:', error);
    return {
      success: false,
      errors: [`Failed to create tag: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Creates multiple tags at once (used when creating posts with new tags)
 */
export async function createTagsBulk(tagNames: string[]): Promise<{
  success: boolean;
  data?: TagWithRelations[];
  errors: string[];
}> {
  const errors: string[] = [];
  const createdTags: TagWithRelations[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      for (const tagName of tagNames) {
        const validation = await validateTagUniqueConstraints({
          name: tagName.trim(),
        });

        if (validation.isValid) {
          const tagData = mapCMSToTag({
            name: validation.validatedData.name,
            slug: validation.validatedData.slug,
            description: '',
            color: '#10B981',
          });

          const tag = await tx.tag.create({
            data: tagData,
            include: {
              _count: {
                select: {
                  posts: true,
                },
              },
            },
          });

          createdTags.push(tag as TagWithRelations);
        } else {
          errors.push(...validation.errors);
        }
      }
    });

    return {
      success: errors.length === 0,
      data: createdTags,
      errors,
    };

  } catch (error) {
    console.error('Error creating tags in bulk:', error);
    return {
      success: false,
      errors: [`Failed to create tags: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

// ============================================================================
// VALIDATION HELPERS FOR CMS UI
// ============================================================================

/**
 * Real-time slug validation for CMS forms
 */
export async function validateSlugForCMS(
  slug: string,
  type: 'post' | 'category' | 'tag',
  excludeId?: string
): Promise<{
  available: boolean;
  suggestion?: string;
  formatted: string;
  errors: string[];
}> {
  const errors: string[] = [];
  const formatted = slug.toLowerCase().trim();

  // Basic format validation
  if (!formatted) {
    errors.push('Slug cannot be empty');
  } else if (formatted.length < 3) {
    errors.push('Slug must be at least 3 characters long');
  } else if (!/^[a-z0-9\-_]+$/.test(formatted)) {
    errors.push('Slug can only contain lowercase letters, numbers, hyphens, and underscores');
  }

  if (errors.length > 0) {
    return {
      available: false,
      formatted,
      errors,
    };
  }

  // Check database availability
  const availability = await checkSlugAvailability(formatted, type, excludeId);

  return {
    available: availability.available,
    suggestion: availability.suggestion,
    formatted,
    errors,
  };
}

/**
 * Auto-generates slug from title for CMS
 */
export async function generateSlugForCMS(
  title: string,
  type: 'post' | 'category' | 'tag',
  excludeId?: string
): Promise<string> {
  if (type === 'post') {
    return await generateSlugFromTitle(title, excludeId);
  }

  // For categories and tags, use simpler slug generation
  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  const availability = await checkSlugAvailability(baseSlug, type, excludeId);
  
  return availability.available ? baseSlug : (availability.suggestion || baseSlug);
}