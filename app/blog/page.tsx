import { Suspense } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { generateMetadata, generateStructuredData, seoUtils } from '@/lib/metadata';
import { PostListSkeleton } from '@/components/ui/skeletons/PostCardSkeleton';
import { featuredPublicPosts, publicCategories } from '@/lib/content-index';
import { getPopularPosts, getRelatedPosts } from '@/lib/internal-linking';

export const revalidate = 3600;

export const metadata = generateMetadata({
  title: 'Latest Articles - The Corporate Blog',
  description: 'Discover the latest insights on technology, business, and innovation. Read expert articles, tutorials, and industry analysis.',
  canonical: '/blog',
});

export default function BlogPage() {
  const popularPosts = getPopularPosts(3);
  const suggestedDeepLinks = getRelatedPosts(
    {
      title: 'technology business innovation',
      excerpt: 'featured insights and analysis',
      tags: ['technology', 'innovation', 'analytics'],
    },
    3
  );

  const structuredData = [
    generateStructuredData('BreadcrumbList', {
      items: [
        { name: 'Home', url: '/' },
        { name: 'Blog', url: '/blog' },
      ],
    }),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Latest Articles',
      url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/blog`,
      hasPart: featuredPublicPosts.map((post) => ({
        '@type': 'Article',
        headline: post.title,
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/blog/${post.slug}`,
      })),
    },
  ];

  return (
    <>
      {structuredData.map((schema, index) => (
        <script
          key={`blog-schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: seoUtils.createJsonLd(schema) }}
        />
      ))}
      <Header />
      <main className="py-16 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Latest Articles
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Stay updated with the latest insights on technology, business strategy, and innovation.
            </p>
          </div>

          <Suspense fallback={<PostListSkeleton />}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredPublicPosts.map((post) => (
                <article key={post.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <p className="text-sm text-primary-700 mb-2">
                    <Link href={`/categories/${post.categorySlug}`}>{post.categoryName}</Link>
                  </p>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </h2>
                  <p className="text-gray-600 mb-4">{post.excerpt}</p>
                  <div className="text-sm text-gray-500">
                    <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                    <span> • </span>
                    <span>{post.readingTime} min read</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-12 p-6 bg-white rounded-xl border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Explore by Topic</h3>
              <div className="flex flex-wrap gap-3">
                {publicCategories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/categories/${category.slug}`}
                    className="px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-white rounded-xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Popular Posts</h3>
                <ul className="space-y-2">
                  {popularPosts.map((post) => (
                    <li key={post.slug}>
                      <Link href={`/blog/${post.slug}`} className="text-primary-700 hover:text-primary-900">
                        {post.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 bg-white rounded-xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Related Picks</h3>
                <ul className="space-y-2">
                  {suggestedDeepLinks.map((post) => (
                    <li key={post.slug}>
                      <Link href={`/blog/${post.slug}`} className="text-primary-700 hover:text-primary-900">
                        {post.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}