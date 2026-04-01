import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { generateMetadata as buildMetadata, generateStructuredData, seoUtils } from '@/lib/metadata';
import { featuredPublicPosts } from '@/lib/content-index';
import { getPopularPosts } from '@/lib/internal-linking';
import { SearchInputWithPreview } from '@/components/search/SearchInputWithPreview';
import { SearchResultsList } from '@/components/search/SearchResultsList';

export const revalidate = 300;

interface SearchPageProps {
  searchParams: {
    q?: string;
  };
}

export function generateMetadata({ searchParams }: SearchPageProps) {
  const query = (searchParams.q || '').trim();

  if (!query) {
    const metadata = buildMetadata({
      title: 'Search Articles - The Corporate Blog',
      description: 'Search across articles, topics, and categories on The Corporate Blog.',
      canonical: '/search',
    });

    return {
      ...metadata,
      robots: {
        index: false,
        follow: true,
        googleBot: {
          index: false,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
    };
  }

  const metadata = buildMetadata({
    title: `Search results for \"${query}\" - The Corporate Blog`,
    description: `Search results for ${query} across technology, business, and innovation articles.`,
    canonical: '/search',
  });

  return {
    ...metadata,
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

function scorePost(query: string, title: string, excerpt: string, category: string): number {
  const q = query.toLowerCase();
  let score = 0;

  if (title.toLowerCase().includes(q)) score += 10;
  if (category.toLowerCase().includes(q)) score += 6;
  if (excerpt.toLowerCase().includes(q)) score += 3;

  const queryTerms = q.split(/\s+/).filter(Boolean);
  for (const term of queryTerms) {
    if (title.toLowerCase().includes(term)) score += 2;
    if (excerpt.toLowerCase().includes(term)) score += 1;
  }

  return score;
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const query = (searchParams.q || '').trim();
  const popular = getPopularPosts(5);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const searchPageUrl = `${siteUrl}/search${query ? `?q=${encodeURIComponent(query)}` : ''}`;

  const results = query
    ? featuredPublicPosts
        .map((post) => ({
          post,
          score: scorePost(query, post.title, post.excerpt, post.categoryName),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.post)
    : [];

  const structuredData = [
    generateStructuredData('BreadcrumbList', {
      items: [
        { name: 'Home', url: '/' },
        { name: 'Search', url: '/search' },
      ],
    }),
    {
      '@context': 'https://schema.org',
      '@type': 'SearchResultsPage',
      name: query ? `Search results for ${query}` : 'Search',
      url: searchPageUrl,
      inLanguage: 'en-US',
      isPartOf: {
        '@type': 'WebSite',
        name: 'The Corporate Blog',
        url: siteUrl,
      },
      about: query || 'Site search',
      keywords: query ? query.split(/\s+/).filter(Boolean).slice(0, 8).join(', ') : 'search, blog articles',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${siteUrl}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
      numberOfItems: results.length,
      mainEntity: results.map((post) => ({
        '@type': 'Article',
        headline: post.title,
        description: post.excerpt,
        url: `${siteUrl}/blog/${post.slug}`,
        datePublished: post.publishedAt,
        articleSection: post.categoryName,
        author: {
          '@type': 'Person',
          name: post.authorName,
          url: `${siteUrl}/authors/${post.authorSlug}`,
        },
      })),
    },
    query
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListOrder: 'https://schema.org/ItemListOrderDescending',
          numberOfItems: results.length,
          name: query ? `Result list for ${query}` : 'Result list',
          itemListElement: results.map((post, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'Article',
              name: post.title,
              description: post.excerpt,
              url: `${siteUrl}/blog/${post.slug}`,
            },
          })),
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'Thing',
          name: 'Search landing state',
        },
  ];

  return (
    <>
      {structuredData.map((schema, index) => (
        <script
          key={`search-schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: seoUtils.createJsonLd(schema) }}
        />
      ))}
      <Header />
      <main className="py-16 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Search Articles</h1>

          <SearchInputWithPreview initialQuery={query} posts={featuredPublicPosts} />

          {query ? (
            <section>
              <p className="text-gray-600 mb-4">{results.length} result(s) for "{query}"</p>
              <SearchResultsList results={results} query={query} />
            </section>
          ) : (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Popular now</h2>
              <ul className="space-y-2">
                {popular.map((post) => (
                  <li key={post.slug}>
                    <Link href={`/blog/${post.slug}`} className="text-primary-700 hover:text-primary-900">
                      {post.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
