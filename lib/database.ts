// Database utility types and functions for The Corporate Blog
// This file provides type-safe helpers for working with Prisma schema

import { User, Post, Category, Tag, Comment, Image, PostStatus, UserRole, CommentStatus, Prisma } from '@prisma/client';

// ============================================================================
// EXTENDED TYPES WITH RELATIONS
// ============================================================================

// User with relations
export type UserWithRelations = User & {
  posts?: PostWithRelations[];
  comments?: CommentWithRelations[];
  uploadedImages?: Image[];
  _count?: {
    posts: number;
    comments: number;
    uploadedImages: number;
  };
};

// Post with all possible relations
export type PostWithRelations = Post & {
  author: User;
  categories?: (PostCategory & { category: Category })[];
  tags?: (PostTag & { tag: Tag })[];
  comments?: CommentWithRelations[];
  _count?: {
    categories: number;
    tags: number;
    comments: number;
    likes: number;
    views: number;
  };
};

// Post with minimal relations for listings
export type PostSummary = Post & {
  author: Pick<User, 'id' | 'name' | 'username' | 'avatar'>;
  categories: (PostCategory & { 
    category: Pick<Category, 'id' | 'name' | 'slug' | 'color'> 
  })[];
  tags: (PostTag & { 
    tag: Pick<Tag, 'id' | 'name' | 'slug' | 'color'> 
  })[];
  _count: {
    comments: number;
    likes: number;
  };
};

// Category with relations
export type CategoryWithRelations = Category & {
  posts?: (PostCategory & { post: PostSummary })[];
  parent?: Category;
  children?: Category[];
  _count?: {
    posts: number;
  };
};

// Comment with relations
export type CommentWithRelations = Comment & {
  author: Pick<User, 'id' | 'name' | 'username' | 'avatar'>;
  post: Pick<Post, 'id' | 'title' | 'slug'>;
  parent?: CommentWithRelations;
  replies?: CommentWithRelations[];
  _count?: {
    replies: number;
  };
};

// Tag with relations
export type TagWithRelations = Tag & {
  posts?: (PostTag & { post: PostSummary })[];
  _count?: {
    posts: number;
  };
};

// Junction table types
export type PostCategory = {
  postId: string;
  categoryId: string;
  order: number;
  createdAt: Date;
  post?: Post;
  category?: Category;
};

export type PostTag = {
  postId: string;
  tagId: string;
  post?: Post;
  tag?: Tag;
};

// ============================================================================
// DATABASE QUERY HELPERS
// ============================================================================

// Common include patterns for Prisma queries
export const USER_INCLUDES = {
  minimal: {
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
    },
  },
  withCounts: {
    include: {
      _count: {
        select: {
          posts: true,
          comments: true,
          uploadedImages: true,
        },
      },
    },
  },
  full: {
    include: {
      posts: {
        where: { status: PostStatus.PUBLISHED },
        take: 5,
        orderBy: { publishedAt: 'desc' },
        include: {
          categories: {
            include: { category: true },
          },
          tags: {
            include: { tag: true },
          },
        },
      },
      _count: {
        select: {
          posts: true,
          comments: true,
          uploadedImages: true,
        },
      },
    },
  },
} as const;

export const POST_INCLUDES = {
  summary: {
    include: {
      author: USER_INCLUDES.minimal,
      categories: {
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      },
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
            },
          },
        },
      },
      _count: {
        select: {
          comments: true,
          likes: true,
        },
      },
    },
  },
  full: {
    include: {
      author: USER_INCLUDES.minimal,
      categories: {
        include: { category: true },
        orderBy: { order: 'asc' },
      },
      tags: {
        include: { tag: true },
      },
      comments: {
        where: { status: CommentStatus.PUBLISHED },
        include: {
          author: USER_INCLUDES.minimal,
          _count: {
            select: { replies: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: {
        select: {
          categories: true,
          tags: true,
          comments: true,
          likes: true,
          views: true,
        },
      },
    },
  },
} as const;

export const CATEGORY_INCLUDES = {
  summary: {
    include: {
      _count: {
        select: { posts: true },
      },
    },
  },
  withPosts: {
    include: {
      posts: {
        include: {
          post: POST_INCLUDES.summary,
        },
        take: 10,
      },
      _count: {
        select: { posts: true },
      },
    },
  },
} as const;

export const COMMENT_INCLUDES = {
  withAuthor: {
    include: {
      author: USER_INCLUDES.minimal,
      post: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      _count: {
        select: { replies: true },
      },
    },
  },
  withReplies: {
    include: {
      author: USER_INCLUDES.minimal,
      replies: {
        include: {
          author: USER_INCLUDES.minimal,
          _count: {
            select: { replies: true },
          },
        },
        where: { status: CommentStatus.PUBLISHED },
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: { replies: true },
      },
    },
  },
} as const;

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

// Post creation/update validation
export const POST_VALIDATION = {
  title: {
    minLength: 5,
    maxLength: 200,
  },
  slug: {
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    maxLength: 100,
  },
  excerpt: {
    maxLength: 500,
  },
  metaDescription: {
    maxLength: 160,
  },
  seoTitle: {
    maxLength: 60,
  },
} as const;

// User validation
export const USER_VALIDATION = {
  username: {
    pattern: /^[a-zA-Z0-9_]{3,20}$/,
    minLength: 3,
    maxLength: 20,
  },
  name: {
    minLength: 2,
    maxLength: 50,
  },
  bio: {
    maxLength: 500,
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
} as const;

// Category validation
export const CATEGORY_VALIDATION = {
  name: {
    minLength: 2,
    maxLength: 50,
  },
  slug: {
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    maxLength: 50,
  },
  description: {
    maxLength: 200,
  },
} as const;

// ============================================================================
// ROLE HIERARCHY
// ============================================================================
export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy = {
    [UserRole.USER]: 0,
    [UserRole.SUBSCRIBER]: 1,
    [UserRole.CONTRIBUTOR]: 2,
    [UserRole.AUTHOR]: 3,
    [UserRole.MODERATOR]: 4,
    [UserRole.EDITOR]: 5,
    [UserRole.ADMIN]: 6,
    [UserRole.SUPER_ADMIN]: 7,
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function canEditPost(userRole: UserRole, postAuthorId: string, userId: string): boolean {
  // Super admins and admins can edit any post
  if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
    return true;
  }
  
  // Editors can edit any post
  if (userRole === UserRole.EDITOR) {
    return true;
  }
  
  // Authors can edit their own posts
  if (userRole === UserRole.AUTHOR && postAuthorId === userId) {
    return true;
  }
  
  return false;
}

export function canModerateComments(userRole: UserRole): boolean {
  return hasPermission(userRole, UserRole.MODERATOR);
}

// ============================================================================
// QUERY BUILDERS
// ============================================================================

// Build where clause for published posts
export function getPublishedPostsWhere(): Prisma.PostWhereInput {
  return {
    status: PostStatus.PUBLISHED,
    publishedAt: {
      lte: new Date(),
    },
  };
}

// Build where clause for posts by category
export function getPostsByCategoryWhere(categorySlug: string): Prisma.PostWhereInput {
  return {
    ...getPublishedPostsWhere(),
    categories: {
      some: {
        category: {
          slug: categorySlug,
          isVisible: true,
        },
      },
    },
  };
}

// Build where clause for posts by tag
export function getPostsByTagWhere(tagSlug: string): Prisma.PostWhereInput {
  return {
    ...getPublishedPostsWhere(),
    tags: {
      some: {
        tag: {
          slug: tagSlug,
        },
      },
    },
  };
}

// Build where clause for posts by author
export function getPostsByAuthorWhere(authorId: string): Prisma.PostWhereInput {
  return {
    ...getPublishedPostsWhere(),
    authorId,
  };
}

// Search posts
export function getSearchPostsWhere(query: string): Prisma.PostWhereInput {
  return {
    ...getPublishedPostsWhere(),
    OR: [
      {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      },
      {
        excerpt: {
          contains: query,
          mode: 'insensitive',
        },
      },
      {
        metaDescription: {
          contains: query,
          mode: 'insensitive',
        },
      },
    ],
  };
}

// ============================================================================
// SLUG UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalizes a string into a URL-friendly slug
 * Converts to lowercase, removes special characters, replaces spaces with hyphens
 */
export function normalizeSlug(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .toLowerCase()
    .trim()
    // Replace spaces and multiple whitespace with hyphens
    .replace(/\s+/g, '-')
    // Remove non-alphanumeric characters except hyphens and underscores
    .replace(/[^a-z0-9\-_]/g, '')
    // Replace multiple consecutive hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading and trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Limit to reasonable length
    .substring(0, 100);
}

/**
 * Generates a unique slug by appending a counter
 */
export function generateUniqueSlug(baseSlug: string, counter: number): string {
  const normalizedSlug = normalizeSlug(baseSlug);
  
  if (counter === 0) {
    return normalizedSlug;
  }
  
  return `${normalizedSlug}-${counter}`;
}

/**
 * Generates a random slug suffix for extreme cases
 */
export function generateRandomSlugSuffix(): string {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Validates slug format
 */
export function isValidSlugFormat(slug: string): boolean {
  if (!slug || typeof slug !== 'string') {
    return false;
  }

  // Must be 1-100 characters
  if (slug.length < 1 || slug.length > 100) {
    return false;
  }

  // Must only contain lowercase letters, numbers, hyphens, and underscores
  if (!/^[a-z0-9\-_]+$/.test(slug)) {
    return false;
  }

  // Cannot start or end with hyphens
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return false;
  }

  // Cannot have consecutive hyphens
  if (slug.includes('--')) {
    return false;
  }

  return true;
}

/**
 * Sanitizes user input for slug generation
 */
export function sanitizeSlugInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    // Convert to lowercase
    .toLowerCase()
    // Replace common accented characters
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace special characters with spaces for better word separation
    .replace(/[^\w\s-]/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// CONTENT ANALYSIS UTILITIES
// ============================================================================

/**
 * Calculates reading time in minutes
 */
export function calculateReadingTime(wordCount: number): number {
  if (!wordCount || wordCount <= 0) return 0;
  return Math.ceil(wordCount / 200); // ~200 words per minute
}

/**
 * Extracts word count from text or HTML content
 */
export function extractWordCount(content: string): number {
  if (!content) return 0;
  // Remove HTML tags
  const textOnly = content.replace(/<[^>]*>/g, '');
  // Count words (split on whitespace)
  return textOnly.trim().split(/\s+/).length;
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

export type {
  User,
  Post,
  Category,
  Tag,
  Comment,
  Image,
  PostStatus,
  UserRole,
  UserStatus,
  CommentStatus,
};

// Export Prisma types
export type {
  Prisma,
};