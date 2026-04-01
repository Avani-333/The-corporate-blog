import { EditorState } from '@/lib/editor-state';
import { prisma } from '@/lib/prisma';
import { 
  PostStatus, 
  Post, 
  Category,
  Tag,
  User,
  Prisma 
} from '@prisma/client';
import { 
  normalizeSlug, 
  generateUniqueSlug, 
  calculateReadingTime, 
  extractWordCount 
} from '@/lib/database';

// ============================================================================
// CMS TO DATABASE FIELD MAPPING
// ============================================================================

/**
 * Maps CMS editor state to database Post model fields
 */
export function mapCMSToPost(
  editorState: EditorState, 
  authorId: string,
  existingPost?: Post
): Prisma.PostCreateInput | Prisma.PostUpdateInput {
  const wordCount = extractWordCount(editorState.content);
  const readingTime = calculateReadingTime(wordCount);

  // Map CMS status to DB PostStatus
  const statusMap: Record<EditorState['post']['status'], PostStatus> = {
    'draft': PostStatus.DRAFT,
    'published': PostStatus.PUBLISHED, 
    'scheduled': PostStatus.SCHEDULED,
    'archived': PostStatus.ARCHIVED,
  };

  const mappedData = {
    // Basic content fields
    title: editorState.post.title,
    slug: editorState.post.slug,
    excerpt: editorState.post.excerpt,
    content: editorState.content, // JSON block content
    contentHtml: convertContentToHTML(editorState.content),
    
    // SEO fields
    seoTitle: editorState.post.seoTitle,
    metaDescription: editorState.post.seoDescription,
    
    // Media fields
    featuredImage: editorState.post.featuredImage,
    featuredImageAlt: extractImageAlt(editorState.post.featuredImage),
    
    // Publishing fields
    status: statusMap[editorState.post.status],
    publishedAt: editorState.post.status === 'published' ? 
      editorState.post.publishedAt || new Date() : 
      editorState.post.publishedAt,
    scheduledAt: editorState.post.scheduledAt,
    
    // Analytics and metadata
    wordCount,
    readingTime,
    version: existingPost ? existingPost.version + 1 : 1,
    
    // Author relationship
    author: {
      connect: { id: authorId }
    }
  };

  return mappedData;
}

/**
 * Maps database Post model to CMS editor state
 */
export function mapPostToCMS(post: Post): Partial<EditorState> {
  // Map DB PostStatus to CMS status
  const statusMap: Record<PostStatus, EditorState['post']['status']> = {
    [PostStatus.DRAFT]: 'draft',
    [PostStatus.PUBLISHED]: 'published',
    [PostStatus.SCHEDULED]: 'scheduled',
    [PostStatus.ARCHIVED]: 'archived',
    [PostStatus.DELETED]: 'archived', // Map deleted to archived for CMS
  };

  return {
    content: post.content as any, // JSON block content
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      status: statusMap[post.status],
      publishedAt: post.publishedAt,
      scheduledAt: post.scheduledAt,
      categories: [], // Will be populated separately via relations
      tags: [], // Will be populated separately via relations
      featuredImage: post.featuredImage,
      seoTitle: post.seoTitle,
      seoDescription: post.metaDescription,
      allowComments: true, // Default or from settings
      isSticky: false, // Default or from additional fields
    }
  };
}

/**
 * Maps CMS category data to database Category model
 */
export function mapCMSToCategory(
  categoryData: {
    name: string;
    slug: string;
    description?: string;
    color?: string;
    icon?: string;
    seoTitle?: string;
    metaDescription?: string;
    parentId?: string;
    isVisible?: boolean;
  }
): Prisma.CategoryCreateInput | Prisma.CategoryUpdateInput {
  return {
    name: categoryData.name,
    slug: categoryData.slug,
    description: categoryData.description,
    color: categoryData.color,
    icon: categoryData.icon,
    seoTitle: categoryData.seoTitle,
    metaDescription: categoryData.metaDescription,
    isVisible: categoryData.isVisible ?? true,
    parent: categoryData.parentId ? {
      connect: { id: categoryData.parentId }
    } : undefined,
  };
}

/**
 * Maps CMS tag data to database Tag model
 */
export function mapCMSToTag(
  tagData: {
    name: string;
    slug: string;
    description?: string;
    color?: string;
  }
): Prisma.TagCreateInput | Prisma.TagUpdateInput {
  return {
    name: tagData.name,
    slug: tagData.slug,
    description: tagData.description,
    color: tagData.color,
  };
}

/**
 * Maps CMS user profile data to database User model
 */
export function mapCMSToUser(
  userData: {
    email: string;
    username?: string;
    name?: string;
    avatar?: string;
    bio?: string;
    website?: string;
    twitter?: string;
    linkedin?: string;
    github?: string;
  },
  existingUser?: User
): Prisma.UserCreateInput | Prisma.UserUpdateInput {
  return {
    email: userData.email,
    username: userData.username,
    name: userData.name,
    avatar: userData.avatar,
    bio: userData.bio,
    website: userData.website,
    twitter: userData.twitter,
    linkedin: userData.linkedin,
    github: userData.github,
    // Preserve existing fields for updates
    role: existingUser?.role,
    status: existingUser?.status,
    emailVerified: existingUser?.emailVerified,
  };
}

// ============================================================================
// RELATIONSHIP MAPPING UTILITIES
// ============================================================================

/**
 * Updates post categories in database
 */
export async function updatePostCategories(
  postId: string, 
  categoryIds: string[]
): Promise<void> {
  // Remove existing categories
  await prisma.postCategory.deleteMany({
    where: { postId }
  });

  // Add new categories with order
  if (categoryIds.length > 0) {
    await prisma.postCategory.createMany({
      data: categoryIds.map((categoryId, index) => ({
        postId,
        categoryId,
        order: index + 1,
      })),
    });
  }
}

/**
 * Updates post tags in database
 */
export async function updatePostTags(
  postId: string, 
  tagIds: string[]
): Promise<void> {
  // Remove existing tags
  await prisma.postTag.deleteMany({
    where: { postId }
  });

  // Add new tags
  if (tagIds.length > 0) {
    await prisma.postTag.createMany({
      data: tagIds.map(tagId => ({
        postId,
        tagId,
      })),
    });
  }
}

/**
 * Retrieves post categories for CMS
 */
export async function getPostCategories(postId: string): Promise<string[]> {
  const categories = await prisma.postCategory.findMany({
    where: { postId },
    orderBy: { order: 'asc' },
    select: { categoryId: true },
  });

  return categories.map(c => c.categoryId);
}

/**
 * Retrieves post tags for CMS
 */
export async function getPostTags(postId: string): Promise<string[]> {
  const tags = await prisma.postTag.findMany({
    where: { postId },
    select: { tagId: true },
  });

  return tags.map(t => t.tagId);
}

// ============================================================================
// CONTENT TRANSFORMATION UTILITIES  
// ============================================================================

/**
 * Converts CMS block content to HTML for storage and display
 */
export function convertContentToHTML(content: any): string {
  if (!content?.blocks || !Array.isArray(content.blocks)) {
    return '';
  }

  return content.blocks.map((block: any) => {
    switch (block.type) {
      case 'paragraph':
        return `<p>${block.data.text || ''}</p>`;
      
      case 'heading':
        const level = block.data.level || 2;
        return `<h${level}>${block.data.text || ''}</h${level}>`;
      
      case 'list':
        const listType = block.data.style === 'ordered' ? 'ol' : 'ul';
        const items = (block.data.items || []).map((item: string) => 
          `<li>${item}</li>`
        ).join('');
        return `<${listType}>${items}</${listType}>`;
      
      case 'quote':
        return `<blockquote><p>${block.data.text || ''}</p>${
          block.data.caption ? `<cite>${block.data.caption}</cite>` : ''
        }</blockquote>`;
      
      case 'code':
        return `<pre><code${
          block.data.language ? ` class="language-${block.data.language}"` : ''
        }>${block.data.code || ''}</code></pre>`;
      
      case 'image':
        return `<img src="${block.data.url || ''}" alt="${block.data.alt || ''}" ${
          block.data.caption ? `title="${block.data.caption}"` : ''
        }>`;
      
      case 'embed':
        return `<div class="embed-container">${block.data.embed || ''}</div>`;
      
      case 'table':
        if (!block.data.content || !Array.isArray(block.data.content)) return '';
        const rows = block.data.content.map((row: string[]) => {
          const cells = row.map(cell => `<td>${cell}</td>`).join('');
          return `<tr>${cells}</tr>`;
        }).join('');
        return `<table>${rows}</table>`;
      
      case 'divider':
        return '<hr>';
      
      case 'highlight':
        return `<div class="highlight-box" style="background-color: ${
          block.data.color || '#fff3cd'
        }"><p>${block.data.text || ''}</p></div>`;
      
      case 'cta':
        return `<div class="cta-block">
          <h3>${block.data.title || ''}</h3>
          <p>${block.data.description || ''}</p>
          ${block.data.buttonText && block.data.buttonUrl ? 
            `<a href="${block.data.buttonUrl}" class="cta-button">${block.data.buttonText}</a>` 
            : ''}
        </div>`;
      
      case 'gallery':
        if (!block.data.images || !Array.isArray(block.data.images)) return '';
        const images = block.data.images.map((img: any) => 
          `<img src="${img.url || ''}" alt="${img.alt || ''}">`
        ).join('');
        return `<div class="gallery">${images}</div>`;
      
      case 'faq':
        if (!block.data.items || !Array.isArray(block.data.items)) return '';
        const faqItems = block.data.items.map((item: any) => `
          <div class="faq-item">
            <h4 class="faq-question">${item.question || ''}</h4>
            <p class="faq-answer">${item.answer || ''}</p>
          </div>
        `).join('');
        return `<div class="faq-container">${faqItems}</div>`;
      
      default:
        return '';
    }
  }).join('\n');
}

/**
 * Extracts image alt text from featured image URL or metadata
 */
export function extractImageAlt(imageUrl?: string): string | undefined {
  if (!imageUrl) return undefined;
  
  // Try to extract meaningful alt text from filename
  const filename = imageUrl.split('/').pop()?.split('.')[0];
  if (filename) {
    return filename
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }
  
  return undefined;
}

/**
 * Validates and transforms content blocks
 */
export function validateAndTransformBlocks(content: any): any {
  if (!content?.blocks || !Array.isArray(content.blocks)) {
    return { blocks: [] };
  }

  const validatedBlocks = content.blocks
    .filter((block: any) => block && block.type && block.data)
    .map((block: any, index: number) => ({
      ...block,
      id: block.id || `block_${index}`,
      order: block.order || index,
      createdAt: block.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

  return {
    ...content,
    blocks: validatedBlocks,
  };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates CMS data before database operations
 */
export function validatePostData(editorState: EditorState): string[] {
  const errors: string[] = [];

  // Title validation
  if (!editorState.post.title.trim()) {
    errors.push('Title is required');
  } else if (editorState.post.title.length > 200) {
    errors.push('Title must be less than 200 characters');
  }

  // Slug validation
  if (!editorState.post.slug.trim()) {
    errors.push('Slug is required');
  } else if (!/^[a-z0-9-]+$/.test(editorState.post.slug)) {
    errors.push('Slug can only contain lowercase letters, numbers, and hyphens');
  }

  // Excerpt validation
  if (editorState.post.excerpt && editorState.post.excerpt.length > 500) {
    errors.push('Excerpt must be less than 500 characters');
  }

  // SEO validation
  if (editorState.post.seoDescription && editorState.post.seoDescription.length > 160) {
    errors.push('Meta description must be less than 160 characters');
  }

  if (editorState.post.seoTitle && editorState.post.seoTitle.length > 60) {
    errors.push('SEO title must be less than 60 characters');
  }

  // Content validation
  if (!editorState.content.blocks || editorState.content.blocks.length === 0) {
    errors.push('Content is required');
  }

  // Scheduled date validation
  if (editorState.post.status === 'scheduled' && !editorState.post.scheduledAt) {
    errors.push('Scheduled date is required for scheduled posts');
  }

  if (editorState.post.scheduledAt && editorState.post.scheduledAt <= new Date()) {
    errors.push('Scheduled date must be in the future');
  }

  return errors;
}

/**
 * Validates category data before database operations
 */
export function validateCategoryData(categoryData: {
  name: string;
  slug: string;
  description?: string;
}): string[] {
  const errors: string[] = [];

  if (!categoryData.name.trim()) {
    errors.push('Category name is required');
  } else if (categoryData.name.length > 50) {
    errors.push('Category name must be less than 50 characters');
  }

  if (!categoryData.slug.trim()) {
    errors.push('Category slug is required');
  } else if (!/^[a-z0-9-]+$/.test(categoryData.slug)) {
    errors.push('Category slug can only contain lowercase letters, numbers, and hyphens');
  }

  if (categoryData.description && categoryData.description.length > 200) {
    errors.push('Category description must be less than 200 characters');
  }

  return errors;
}

/**
 * Validates tag data before database operations
 */
export function validateTagData(tagData: {
  name: string;
  slug: string;
  description?: string;
}): string[] {
  const errors: string[] = [];

  if (!tagData.name.trim()) {
    errors.push('Tag name is required');
  } else if (tagData.name.length > 30) {
    errors.push('Tag name must be less than 30 characters');
  }

  if (!tagData.slug.trim()) {
    errors.push('Tag slug is required');
  } else if (!/^[a-z0-9-]+$/.test(tagData.slug)) {
    errors.push('Tag slug can only contain lowercase letters, numbers, and hyphens');
  }

  if (tagData.description && tagData.description.length > 100) {
    errors.push('Tag description must be less than 100 characters');
  }

  return errors;
}

/**
 * Validates CMS editor state
 */
export function validateCMSData(editorState: EditorState | any): {
  isValid: boolean;
  errors: string[];
  fieldErrors?: Record<string, string>;
} {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  if (!editorState) {
    return { isValid: false, errors: ['Editor state is required'], fieldErrors };
  }

  if (!editorState.post) {
    errors.push('Post data is required');
  } else {
    const postErrors = validatePostData(editorState);
    if (postErrors.length > 0) {
      errors.push(...postErrors);
    }
  }

  if (!editorState.content || !Array.isArray(editorState.content) || editorState.content.length === 0) {
    errors.push('Content is required and must be non-empty');
  }

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  };
}