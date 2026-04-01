import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { generateMetadata as buildMetadata, generateStructuredData, seoUtils } from '@/lib/metadata';
import {
  getPostsByCategorySlug,
  getPublicCategoryBySlug,
  publicCategories,
} from '@/lib/content-index';

export const revalidate = 3600;

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  return publicCategories.map((category) => ({ slug: category.slug }));
}

export function generateMetadata({ params }: CategoryPageProps) {
  const category = getPublicCategoryBySlug(params.slug);

  if (!category) {
    return buildMetadata({
      title: 'Category Not Found - The Corporate Blog',
      description: 'The requested category does not exist.',
      canonical: `/categories/${params.slug}`,
      noIndex: true,
    });
  }

  return buildMetadata({
    title: `${category.name} Articles - The Corporate Blog`,
    description: category.description,
    canonical: `/categories/${category.slug}`,
    keywords: [category.name, 'articles', 'insights'],
    section: category.name,
  });
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const category = getPublicCategoryBySlug(params.slug);

  if (!category) {
    notFound();
  }

  const posts = getPostsByCategorySlug(category.slug);

  const structuredData = [
    generateStructuredData('BreadcrumbList', {
      items: [
        { name: 'Home', url: '/' },
        { name: 'Categories', url: '/categories' },
        { name: category.name, url: `/categories/${category.slug}` },
      ],
    }),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${category.name} Articles`,
      description: category.description,
      url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/categories/${category.slug}`,
      hasPart: posts.map((post) => ({
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
          key={`category-schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: seoUtils.createJsonLd(schema) }}
        />
      ))}
      <Header />
      <main className="py-16 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <nav className="text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-primary-700">Home</Link>
            <span> / </span>
            <Link href="/categories" className="hover:text-primary-700">Categories</Link>
            <span> / </span>
            <span>{category.name}</span>
          </nav>

          <header className="mb-10">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">{category.name}</h1>
            <p className="text-xl text-gray-600 max-w-3xl">{category.description}</p>
          </header>

          {posts.length > 0 ? (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {posts.map((post) => (
                <article key={post.slug} className="bg-white border border-gray-200 rounded-xl p-6">
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
            </section>
          ) : (
            <section className="bg-white border border-gray-200 rounded-xl p-8">
              <p className="text-gray-600">No articles are available in this category yet.</p>
              <Link href="/blog" className="text-primary-700 hover:text-primary-900 font-medium mt-3 inline-block">
                View all latest articles
              </Link>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
