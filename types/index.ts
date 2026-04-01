export interface User {
  id: string;
  email: string;
  name?: string;
  username?: string;
  avatar?: string;
  bio?: string;
  password?: string;  // Optional for interface (excluded in responses)
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  status: PostStatus;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  author: User;
  categories: Category[];
  featuredImage?: string;
  readingTime: number;
  viewCount: number;
  seoTitle?: string;
  seoDescription?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  postCount: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount: number;
  color?: string;
}

export interface Comment {
  id: string;
  content: string;
  author: {
    name: string;
    email: string;
    avatar?: string;
  };
  postId: string;
  parentId?: string;
  replies?: Comment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SEOMetadata {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  keywords?: string[];
  noIndex?: boolean;
  structuredData?: Record<string, any>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: PaginationMeta;
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',     // Complete system control
  ADMIN = 'ADMIN',                 // Administrative functions
  MODERATOR = 'MODERATOR',         // Comment and user moderation
  EDITOR = 'EDITOR',               // Content editing and publishing
  AUTHOR = 'AUTHOR',               // Content creation
  CONTRIBUTOR = 'CONTRIBUTOR',     // Limited content creation
  SUBSCRIBER = 'SUBSCRIBER',       // Premium content access
  GUEST = 'GUEST',                 // Basic guest access
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE', 
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum PostStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  SCHEDULED = 'SCHEDULED',
  ARCHIVED = 'ARCHIVED',
}

export interface BlockContent {
  id: string;
  type: BlockType;
  content: any;
  order: number;
}

export enum BlockType {
  PARAGRAPH = 'PARAGRAPH',
  HEADING = 'HEADING',
  IMAGE = 'IMAGE',
  LIST = 'LIST',
  QUOTE = 'QUOTE',
  CODE = 'CODE',
  EMBED = 'EMBED',
  TABLE = 'TABLE',
  FAQ = 'FAQ',
}

// ============================================================================
// URL AND SLUG TYPES
// ============================================================================

export interface SlugOptions {
  maxLength?: number;
  prefix?: string;
  suffix?: string;
  allowNumbers?: boolean;
  preserveCase?: boolean;
}

export interface UrlBuildOptions {
  includeHost?: boolean;
  host?: string;
  protocol?: 'http' | 'https';
}

export type ContentType = 'post' | 'category' | 'tag' | 'author' | 'page';

export interface UrlConfig {
  baseUrl: string;
  blogPath: string;
  categoriesPath: string;
  tagsPath: string;
  authorsPath: string;
  dashboardPath: string;
  apiPath: string;
}

export interface SlugValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ParsedUrl {
  slug?: string;
  category?: string;
  isValid: boolean;
}

// ============================================================================
// ANALYTICS AND PERFORMANCE TYPES
// ============================================================================

export interface PostAnalytics {
  postId: string;
  views: number;
  uniqueViews: number;
  avgTimeOnPage: number;
  bounceRate: number;
  socialShares: number;
  comments: number;
  date: Date;
}

export interface TrafficSource {
  source: string;
  visits: number;
  percentage: number;
  trend: number;
}