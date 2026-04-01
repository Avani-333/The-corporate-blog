export interface PublicCategory {
  name: string;
  slug: string;
  description: string;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'red';
  postCount: number;
  trending: boolean;
}

export interface PublicPost {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  categorySlug: string;
  categoryName: string;
  categoryColor: PublicCategory['color'];
  authorName: string;
  authorSlug: string;
  publishedAt: string;
  readingTime: number;
  /** Block-editor JSON stored on the post. Present for DB-backed posts. */
  content?: { blocks?: any[]; metadata?: any; [key: string]: any };
}

export const publicCategories: PublicCategory[] = [
  {
    name: 'Technology',
    slug: 'technology',
    description: 'Latest in software development, AI, and digital innovation',
    color: 'blue',
    postCount: 45,
    trending: true,
  },
  {
    name: 'Business',
    slug: 'business',
    description: 'Strategic insights, market trends, and industry analysis',
    color: 'green',
    postCount: 38,
    trending: false,
  },
  {
    name: 'Innovation',
    slug: 'innovation',
    description: 'Breakthrough ideas and disruptive technologies',
    color: 'purple',
    postCount: 29,
    trending: true,
  },
  {
    name: 'Startup',
    slug: 'startup',
    description: 'Entrepreneurship, funding, and scaling businesses',
    color: 'orange',
    postCount: 33,
    trending: false,
  },
  {
    name: 'Leadership',
    slug: 'leadership',
    description: 'Management strategies and team building insights',
    color: 'indigo',
    postCount: 22,
    trending: false,
  },
  {
    name: 'Analytics',
    slug: 'analytics',
    description: 'Data science, metrics, and performance insights',
    color: 'red',
    postCount: 18,
    trending: true,
  },
];

export const featuredPublicPosts: PublicPost[] = [
  {
    id: '1',
    title: 'Building Production-Grade APIs with Node.js and TypeScript',
    excerpt: 'Learn how to create scalable, maintainable APIs using modern TypeScript patterns and industry best practices.',
    slug: 'building-production-grade-apis-nodejs-typescript',
    categorySlug: 'technology',
    categoryName: 'Technology',
    categoryColor: 'blue',
    authorName: 'Sarah Chen',
    authorSlug: 'sarah-chen',
    publishedAt: '2024-03-01T10:00:00Z',
    readingTime: 8,
  },
  {
    id: '2',
    title: 'The Future of Remote Work: Trends and Technologies',
    excerpt: 'Exploring how emerging technologies are reshaping the way we work and collaborate in distributed teams.',
    slug: 'future-remote-work-trends-technologies',
    categorySlug: 'business',
    categoryName: 'Business',
    categoryColor: 'green',
    authorName: 'Michael Rodriguez',
    authorSlug: 'michael-rodriguez',
    publishedAt: '2024-02-28T14:30:00Z',
    readingTime: 12,
  },
  {
    id: '3',
    title: 'AI-Driven Content Strategy: A Complete Guide',
    excerpt: 'Discover how artificial intelligence is revolutionizing content creation, curation, and distribution strategies.',
    slug: 'ai-driven-content-strategy-complete-guide',
    categorySlug: 'innovation',
    categoryName: 'Innovation',
    categoryColor: 'purple',
    authorName: 'Emily Zhang',
    authorSlug: 'emily-zhang',
    publishedAt: '2024-02-25T09:15:00Z',
    readingTime: 15,
  },
];

export function getPublicCategoryBySlug(slug: string): PublicCategory | undefined {
  return publicCategories.find((category) => category.slug === slug);
}

export function getPublicPostBySlug(slug: string): PublicPost | undefined {
  if (slug === 'sample-post-slug') {
    return featuredPublicPosts[0];
  }

  return featuredPublicPosts.find((post) => post.slug === slug);
}

export function getPostsByCategorySlug(categorySlug: string): PublicPost[] {
  return featuredPublicPosts.filter((post) => post.categorySlug === categorySlug);
}
