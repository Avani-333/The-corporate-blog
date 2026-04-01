import { Suspense } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/home/HeroSection';
import { FeaturedPosts } from '@/components/home/FeaturedPosts';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { NewsletterSection } from '@/components/home/NewsletterSection';
import { PostCardSkeleton } from '@/components/ui/skeletons/PostCardSkeleton';
import { generateMetadata, generateStructuredData, seoUtils } from '@/lib/metadata';
import { featuredPublicPosts, publicCategories } from '@/lib/content-index';

export const revalidate = 3600;

export const metadata = generateMetadata({
  title: 'The Corporate Blog - Production-Grade Blogging Platform',
  description: 'Discover the latest insights on technology, business, and innovation. Read expert articles, tutorials, and industry analysis.',
  canonical: '/',
});

export default function HomePage() {
  const structuredData = [
    generateStructuredData('Organization', {}),
    generateStructuredData('WebSite', {}),
    generateStructuredData('BreadcrumbList', {
      items: [{ name: 'Home', url: '/' }],
    }),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Featured Articles',
      itemListElement: featuredPublicPosts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/blog/${post.slug}`,
        name: post.title,
      })),
    },
  ];

  return (
    <>
      {structuredData.map((schema, index) => (
        <script
          key={`home-schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: seoUtils.createJsonLd(schema) }}
        />
      ))}
      <Header />
      <main>
        <HeroSection />
        
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                Featured Articles
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Discover our most popular and impactful content
              </p>
            </div>
            <Suspense 
              fallback={
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[...Array(6)].map((_, i) => (
                    <PostCardSkeleton key={i} />
                  ))}
                </div>
              }
            >
              <FeaturedPosts />
            </Suspense>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                Explore Categories
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Browse content by your interests
              </p>
            </div>
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-64" />}>
              <CategoryGrid />
            </Suspense>
          </div>
        </section>

        <NewsletterSection />

        <section className="py-16 bg-slate-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Trending Topic Hubs</h2>
                <ul className="space-y-3">
                  {publicCategories.filter((category) => category.trending).map((category) => (
                    <li key={category.slug}>
                      <Link href={`/categories/${category.slug}`} className="text-primary-700 hover:text-primary-900 font-medium">
                        {category.name} ({category.postCount} articles)
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Reader Journey Links</h2>
                <ul className="space-y-3">
                  <li><Link href="/blog" className="text-primary-700 hover:text-primary-900 font-medium">Start with the latest articles</Link></li>
                  <li><Link href="/categories" className="text-primary-700 hover:text-primary-900 font-medium">Browse all editorial categories</Link></li>
                  <li><Link href="/search" className="text-primary-700 hover:text-primary-900 font-medium">Use site search to find specific topics</Link></li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}