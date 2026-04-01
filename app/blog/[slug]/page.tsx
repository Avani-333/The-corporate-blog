import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { generateMetadata as buildMetadata, generateStructuredData, seoUtils } from '@/lib/metadata';
import { featuredPublicPosts, getPublicPostBySlug, publicCategories } from '@/lib/content-index';
import { getPopularPosts, getRelatedPosts } from '@/lib/internal-linking';
import { PostFAQSchema } from '@/components/blog/PostFAQSchema';
import { PostAuthorSchema } from '@/components/blog/PostAuthorSchema';

export const revalidate = 3600;

interface PostPageProps {
  params: {
    slug: string;
  };
}

interface RelatedSuggestion {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  ranking_score?: number;
}

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

function getSuggestionsApiUrl(postId: string, limit: number): string {
  const rawBase =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000';

  const base = rawBase.replace(/\/+$/, '');
  const hasApiSegment = /\/api(\/|$)/.test(base);

  if (hasApiSegment) {
    return `${base}/posts/${postId}/internal-suggestions?limit=${limit}`;
  }

  return `${base}/api/posts/${postId}/internal-suggestions?limit=${limit}`;
}

async function fetchRelatedSuggestions(postId: string, limit = 3): Promise<RelatedSuggestion[]> {
  const requestUrl = getSuggestionsApiUrl(postId, limit);

  try {
    const response = await fetch(requestUrl, {
      method: 'GET',
      next: { revalidate },
      headers: {
        Accept: 'application/json',
      },
    } as NextFetchInit);

    if (!response.ok) {
      return [];
    }

    const json = await response.json();
    return (json?.data?.suggestions || []) as RelatedSuggestion[];
  } catch {
    return [];
  }
}

function RelatedArticlesShimmer() {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-8 mb-8" aria-busy="true" aria-live="polite">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Related Articles</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[11rem]">
        {[0, 1, 2].map((slot) => (
          <div key={slot} className="rounded-lg border border-gray-200 p-4 min-h-[11rem]">
            <div className="h-4 w-20 rounded bg-gray-200 animate-pulse mb-3" />
            <div className="h-5 w-11/12 rounded bg-gray-200 animate-pulse mb-2" />
            <div className="h-4 w-full rounded bg-gray-200 animate-pulse mb-2" />
            <div className="h-4 w-3/4 rounded bg-gray-200 animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}

async function RelatedArticlesSection({
  postId,
  fallbackPosts,
}: {
  postId: string;
  fallbackPosts: ReturnType<typeof getRelatedPosts>;
}) {
  const suggestions = await fetchRelatedSuggestions(postId, 3);

  const items =
    suggestions.length > 0
      ? suggestions.map((item) => ({
          slug: item.slug,
          title: item.title,
          excerpt: item.excerpt || 'Explore this related article for deeper context.',
          rankingScore: item.ranking_score,
          categoryName: 'Related',
        }))
      : fallbackPosts.map((post) => ({
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          rankingScore: undefined,
          categoryName: post.categoryName,
        }));

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-8 mb-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Related Articles</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[11rem]">
        {items.map((item) => (
          <Link
            key={item.slug}
            href={`/blog/${item.slug}`}
            className="rounded-lg border border-gray-200 p-4 min-h-[11rem] hover:border-primary-300 hover:bg-primary-50 transition-colors"
          >
            <p className="text-sm text-primary-700 mb-2">{item.categoryName}</p>
            <p className="font-semibold text-gray-900 mb-2 line-clamp-2">{item.title}</p>
            <p className="text-sm text-gray-600 line-clamp-3">{item.excerpt}</p>
            {typeof item.rankingScore === 'number' && (
              <p className="text-xs text-gray-400 mt-3">Score: {item.rankingScore.toFixed(3)}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function generateStaticParams() {
  return featuredPublicPosts.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: PostPageProps) {
  const post = getPublicPostBySlug(params.slug);

  if (!post) {
    return buildMetadata({
      title: 'Article Not Found - The Corporate Blog',
      description: 'The requested article does not exist.',
      canonical: `/blog/${params.slug}`,
      noIndex: true,
    });
  }

  return buildMetadata({
    title: `${post.title} - The Corporate Blog`,
    description: post.excerpt,
    canonical: `/blog/${post.slug}`,
    publishedTime: post.publishedAt,
    authors: [post.authorName],
    section: post.categoryName,
    tags: [post.categoryName, 'blog', 'insights'],
  });
}

export default function PostPage({ params }: PostPageProps) {
  const post = getPublicPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  const safePost = post as NonNullable<typeof post>;

  const relatedPosts = getRelatedPosts(
    {
      postSlug: safePost.slug,
      title: safePost.title,
      excerpt: safePost.excerpt,
      categorySlug: safePost.categorySlug,
      tags: [safePost.categoryName],
    },
    3
  );
  const popularPosts = getPopularPosts(3).filter((item) => item.slug !== safePost.slug);
  const currentCategory = publicCategories.find((category) => category.slug === safePost.categorySlug);

  const structuredData = [
    generateStructuredData('BreadcrumbList', {
      items: [
        { name: 'Home', url: '/' },
        { name: 'Blog', url: '/blog' },
        { name: safePost.title, url: `/blog/${safePost.slug}` },
      ],
    }),
    generateStructuredData('Article', {
      title: safePost.title,
      description: safePost.excerpt,
      slug: safePost.slug,
      publishedAt: safePost.publishedAt,
      updatedAt: safePost.publishedAt,
      readingTime: safePost.readingTime,
      author: {
        name: safePost.authorName,
        slug: safePost.authorSlug,
      },
      category: {
        name: safePost.categoryName,
      },
      tags: [safePost.categoryName, 'insights'],
    }),
  ];

  return (
    <>
      {structuredData.map((schema, index) => (
        <script
          key={`post-schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: seoUtils.createJsonLd(schema) }}
        />
      ))}
      <PostAuthorSchema
        authorName={safePost.authorName}
        authorSlug={safePost.authorSlug}
      />
      {/* FAQPage schema — only emitted when the post contains FAQ blocks */}
      <PostFAQSchema content={safePost.content} />
      <Header />
      <main className="py-16 bg-gray-50 min-h-screen">
        <article className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <nav className="text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-primary-700">Home</Link>
            <span> / </span>
            <Link href="/blog" className="hover:text-primary-700">Blog</Link>
            <span> / </span>
            <span>{safePost.title}</span>
          </nav>

          <header className="mb-8">
            <p className="text-sm font-semibold text-primary-700 mb-3">
              <Link href={`/categories/${safePost.categorySlug}`}>{safePost.categoryName}</Link>
            </p>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{safePost.title}</h1>
            <p className="text-xl text-gray-600 mb-4">{safePost.excerpt}</p>
            <div className="text-sm text-gray-500">
              <span>{new Date(safePost.publishedAt).toLocaleDateString()}</span>
              <span> • </span>
              <span>{safePost.readingTime} min read</span>
              <span> • </span>
              <span>{safePost.authorName}</span>
            </div>
          </header>

          <section className="bg-white border border-gray-200 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Key Takeaways</h2>
            <p className="text-gray-700 leading-8 mb-4">
              This article is part of the public content prototype and demonstrates a fully crawlable detail page for SEO depth, structured data coverage, and user journey continuity.
            </p>
            <p className="text-gray-700 leading-8">
              Publish-ready content can replace this placeholder body while preserving metadata, canonical URLs, breadcrumbs, and related-link pathways.
            </p>
          </section>

          <Suspense fallback={<RelatedArticlesShimmer />}>
            <RelatedArticlesSection postId={safePost.id} fallbackPosts={relatedPosts} />
          </Suspense>

          <section className="bg-white border border-gray-200 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Continue Exploring</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <p className="text-sm text-primary-700 mb-1">{related.categoryName}</p>
                  <p className="font-medium text-gray-900">{related.title}</p>
                </Link>
              ))}
            </div>
            {currentCategory && (
              <div className="mt-6">
                <Link href={`/categories/${currentCategory.slug}`} className="text-primary-700 hover:text-primary-900 font-medium">
                  View all {currentCategory.name} articles
                </Link>
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Popular Reads</h2>
            <ul className="space-y-3">
              {popularPosts.map((popular) => (
                <li key={popular.slug}>
                  <Link href={`/blog/${popular.slug}`} className="text-primary-700 hover:text-primary-900 font-medium">
                    {popular.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
