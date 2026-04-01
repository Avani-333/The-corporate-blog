/**
 * Blog Post Service - Example implementation using URL standards
 * Demonstrates practical usage of slug utilities and URL conventions
 */

import { 
  generateSlug, 
  validateSlug, 
  ensureUniqueSlug,
  buildPostUrl,
  buildCategoryUrl,
  buildAuthorUrl 
} from '@/lib/url-utils';
import { SLUG_CONFIG, URL_CONFIG } from '@/config/url-config';
import { Post, Category, User, PostStatus } from '@/types';

// ============================================================================
// BLOG POST SERVICE
// ============================================================================

interface CreatePostInput {
  title: string;
  content: string;
  excerpt?: string;
  categoryId?: string;
  tags?: string[];
  status?: PostStatus;
  customSlug?: string;
  seoTitle?: string;
  seoDescription?: string;
}

interface UpdatePostInput extends Partial<CreatePostInput> {
  id: string;
}

export class BlogPostService {
  
  /**
   * Create a new blog post with auto-generated or custom slug
   */
  async createPost(input: CreatePostInput, authorId: string): Promise<Post> {
    // Generate or validate slug
    const slug = await this.generatePostSlug(input.title, input.customSlug);
    
    // Build the post object
    const post: Omit<Post, 'id' | 'createdAt' | 'updatedAt' | 'author' | 'categories'> = {
      title: input.title,
      slug,
      content: input.content,
      excerpt: input.excerpt || this.generateExcerpt(input.content),
      status: input.status || PostStatus.DRAFT,
      publishedAt: input.status === PostStatus.PUBLISHED ? new Date() : undefined,
      featuredImage: undefined,
      readingTime: this.calculateReadingTime(input.content),
      viewCount: 0,
      seoTitle: input.seoTitle || input.title,
      seoDescription: input.seoDescription || input.excerpt
    };

    // Save to database (pseudo-code)
    const savedPost = await this.savePost(post, authorId, input.categoryId, input.tags);
    
    return savedPost;
  }

  /**
   * Update an existing blog post
   */
  async updatePost(input: UpdatePostInput): Promise<Post> {
    const existingPost = await this.getPostById(input.id);
    if (!existingPost) {
      throw new Error('Post not found');
    }

    // Handle slug updates
    let slug = existingPost.slug;
    if (input.title && input.title !== existingPost.title) {
      // Title changed, potentially update slug
      if (input.customSlug) {
        slug = await this.generatePostSlug(input.title, input.customSlug);
      } else if (existingPost.status === PostStatus.DRAFT) {
        // Only auto-update slug for drafts
        slug = await this.generatePostSlug(input.title);
      }
    } else if (input.customSlug) {
      slug = await this.generatePostSlug(input.title || existingPost.title, input.customSlug);
    }

    // Update post data
    const updatedData = {
      ...existingPost,
      ...input,
      slug,
      updatedAt: new Date(),
      // If publishing for the first time, set publishedAt
      publishedAt: input.status === PostStatus.PUBLISHED && !existingPost.publishedAt 
        ? new Date() 
        : existingPost.publishedAt
    };

    const updatedPost = await this.savePost(updatedData, existingPost.author.id, input.categoryId);
    
    return updatedPost;
  }

  /**
   * Generate a unique slug for a post
   */
  private async generatePostSlug(title: string, customSlug?: string): Promise<string> {
    let baseSlug: string;
    
    if (customSlug) {
      // Validate custom slug
      const validation = validateSlug(customSlug, 'post');
      if (!validation.isValid) {
        throw new Error(`Invalid slug: ${validation.errors.join(', ')}`);
      }
      baseSlug = customSlug;
    } else {
      // Generate from title
      baseSlug = generateSlug(title, { 
        maxLength: SLUG_CONFIG.postSlugMax 
      });
    }

    // Ensure uniqueness
    const existingSlugs = await this.getExistingPostSlugs();
    const uniqueSlug = ensureUniqueSlug(baseSlug, existingSlugs);
    
    return uniqueSlug;
  }

  /**
   * Get all existing post slugs (for uniqueness check)
   */
  private async getExistingPostSlugs(): Promise<string[]> {
    // This would query your database
    // For demo purposes, returning mock data
    return [
      'getting-started-with-nextjs',
      'react-performance-tips',
      'typescript-best-practices'
    ];
  }

  /**
   * Generate excerpt from content
   */
  private generateExcerpt(content: string, maxLength: number = 160): string {
    // Strip HTML/Markdown and get first paragraph
    const plainText = content
      .replace(/<[^>]*>/g, '') // Remove HTML
      .replace(/[#*_~`]/g, '') // Remove Markdown formatting
      .trim();

    if (plainText.length <= maxLength) {
      return plainText;
    }

    // Truncate at word boundary
    const truncated = plainText.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return lastSpace > maxLength * 0.7 
      ? truncated.substring(0, lastSpace) + '...'
      : truncated + '...';
  }

  /**
   * Calculate reading time based on content
   */
  private calculateReadingTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = content
      .replace(/<[^>]*>/g, '') // Remove HTML
      .split(/\s+/)
      .filter(word => word.length > 0).length;
    
    return Math.ceil(wordCount / wordsPerMinute);
  }

  // Mock database methods (replace with actual implementation)
  private async savePost(post: any, authorId: string, categoryId?: string, tags?: string[]): Promise<Post> {
    // Implement actual database save logic here
    throw new Error('Method not implemented - replace with database logic');
  }

  private async getPostById(id: string): Promise<Post | null> {
    // Implement actual database query here
    throw new Error('Method not implemented - replace with database logic');
  }
}

// ============================================================================
// CATEGORY SERVICE
// ============================================================================

interface CreateCategoryInput {
  name: string;
  description?: string;
  color?: string;
  customSlug?: string;
}

export class CategoryService {
  
  /**
   * Create a new category with auto-generated slug
   */
  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const slug = await this.generateCategorySlug(input.name, input.customSlug);
    
    const category: Omit<Category, 'id' | 'postCount'> = {
      name: input.name,
      slug,
      description: input.description,
      color: input.color
    };

    // Save to database
    const savedCategory = await this.saveCategory(category);
    
    return savedCategory;
  }

  /**
   * Generate unique category slug
   */
  private async generateCategorySlug(name: string, customSlug?: string): Promise<string> {
    let baseSlug: string;
    
    if (customSlug) {
      const validation = validateSlug(customSlug, 'category');
      if (!validation.isValid) {
        throw new Error(`Invalid slug: ${validation.errors.join(', ')}`);
      }
      baseSlug = customSlug;
    } else {
      baseSlug = generateSlug(name, { 
        maxLength: SLUG_CONFIG.categorySlugMax 
      });
    }

    // Ensure uniqueness
    const existingSlugs = await this.getExistingCategorySlugs();
    return ensureUniqueSlug(baseSlug, existingSlugs);
  }

  private async getExistingCategorySlugs(): Promise<string[]> {
    // Mock implementation - replace with actual database query
    return ['web-development', 'artificial-intelligence', 'devops'];
  }

  private async saveCategory(category: any): Promise<Category> {
    throw new Error('Method not implemented - replace with database logic');
  }
}

// ============================================================================
// URL BUILDER SERVICE
// ============================================================================

export class UrlBuilderService {
  
  /**
   * Build all necessary URLs for a blog post
   */
  static buildPostUrls(post: Post): {
    canonical: string;
    edit: string;
    preview: string;
    api: string;
    author: string;
    category?: string;
  } {
    return {
      canonical: buildPostUrl(post.slug, { includeHost: true }),
      edit: `/dashboard/posts/${post.id}/edit`,
      preview: buildPostUrl(post.slug, { includeHost: true }) + '?preview=true',
      api: `/api/v1/posts/${post.id}`,
      author: buildAuthorUrl(post.author.username || post.author.id, undefined, { includeHost: true }),
      category: post.categories[0] ? buildCategoryUrl(post.categories[0].slug, { includeHost: true }) : undefined
    };
  }

  /**
   * Build sitemap entries for a post
   */
  static buildSitemapEntry(post: Post): {
    loc: string;
    lastmod: string;
    changefreq: string;
    priority: string;
  } {
    return {
      loc: buildPostUrl(post.slug, { includeHost: true }),
      lastmod: post.updatedAt.toISOString().split('T')[0],
      changefreq: 'weekly',
      priority: post.status === PostStatus.PUBLISHED ? '0.8' : '0.3'
    };
  }

  /**
   * Build breadcrumb data for a post
   */
  static buildBreadcrumbs(post: Post): Array<{
    name: string;
    url: string;
  }> {
    const breadcrumbs = [
      { name: 'Home', url: '/' },
      { name: 'Blog', url: URL_CONFIG.blogPath }
    ];

    // Add category if exists
    if (post.categories[0]) {
      breadcrumbs.push({
        name: post.categories[0].name,
        url: buildCategoryUrl(post.categories[0].slug)
      });
    }

    // Add current post
    breadcrumbs.push({
      name: post.title,
      url: buildPostUrl(post.slug)
    });

    return breadcrumbs;
  }
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// Example 1: Creating a blog post
const blogService = new BlogPostService();

const newPost = await blogService.createPost({
  title: 'Getting Started with Next.js 14: A Complete Guide',
  content: '# Introduction\n\nNext.js 14 brings exciting new features...',
  excerpt: 'Learn how to build modern web applications with Next.js 14',
  categoryId: 'web-development-id',
  tags: ['nextjs', 'react', 'typescript'],
  status: PostStatus.PUBLISHED
}, 'author-id');

console.log('Post URL:', buildPostUrl(newPost.slug, { includeHost: true }));
// Output: https://thecorporateblog.com/blog/getting-started-with-nextjs-14-complete-guide

// Example 2: Building URLs for a post
const urls = UrlBuilderService.buildPostUrls(newPost);
console.log('Canonical URL:', urls.canonical);
console.log('Edit URL:', urls.edit);
console.log('Author URL:', urls.author);

// Example 3: Creating a category
const categoryService = new CategoryService();

const newCategory = await categoryService.createCategory({
  name: 'Web Development & Design',
  description: 'Articles about modern web development practices and design principles',
  color: '#3B82F6'
});

console.log('Category URL:', buildCategoryUrl(newCategory.slug, { includeHost: true }));
// Output: https://thecorporateblog.com/categories/web-development-design

// Example 4: Building breadcrumbs
const breadcrumbs = UrlBuilderService.buildBreadcrumbs(newPost);
console.log('Breadcrumbs:', breadcrumbs);
// Output: [
//   { name: 'Home', url: '/' },
//   { name: 'Blog', url: '/blog' },
//   { name: 'Web Development', url: '/categories/web-development' },
//   { name: 'Getting Started with Next.js 14: A Complete Guide', url: '/blog/getting-started-with-nextjs-14-complete-guide' }
// ]
*/