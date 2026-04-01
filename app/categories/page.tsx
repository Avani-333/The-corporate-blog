import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { generateMetadata, generateStructuredData, seoUtils } from '@/lib/metadata';
import { CategoryCardSkeleton } from '@/components/ui/skeletons/PostCardSkeleton';
import { publicCategories } from '@/lib/content-index';

export const revalidate = 3600;

export const metadata = generateMetadata({
  title: 'Categories - The Corporate Blog',
  description: 'Browse articles by category. Find content on technology, business, innovation, startups, leadership, and analytics.',
  canonical: '/categories',
});

export default function CategoriesPage() {
  const structuredData = [
    generateStructuredData('BreadcrumbList', {
      items: [
        { name: 'Home', url: '/' },
        { name: 'Categories', url: '/categories' },
      ],
    }),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Blog Categories',
      url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/categories`,
      hasPart: publicCategories.map((category) => ({
        '@type': 'CollectionPage',
        name: category.name,
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/categories/${category.slug}`,
      })),
    },
  ];

  return (
    <>
      {structuredData.map((schema, index) => (
        <script
          key={`categories-schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: seoUtils.createJsonLd(schema) }}
        />
      ))}
      <Header />
      <main className="py-16 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Browse by Category
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover content tailored to your interests. From cutting-edge technology 
              to business strategy, find the topics that matter most to you.
            </p>
          </div>

          <Suspense 
            fallback={
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <CategoryCardSkeleton key={i} />
                ))}
              </div>
            }
          >
            <CategoryGrid />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}