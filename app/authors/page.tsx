import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { featuredPublicPosts } from '@/lib/content-index';
import { generateMetadata } from '@/lib/metadata';

export const metadata = generateMetadata({
  title: 'Authors - The Corporate Blog',
  description: 'Meet the writers behind The Corporate Blog.',
  canonical: '/authors',
});

function buildAuthorList() {
  const map = new Map<string, { slug: string; name: string; posts: number }>();

  for (const post of featuredPublicPosts) {
    const existing = map.get(post.authorSlug);
    if (existing) {
      existing.posts += 1;
    } else {
      map.set(post.authorSlug, {
        slug: post.authorSlug,
        name: post.authorName,
        posts: 1,
      });
    }
  }

  return Array.from(map.values());
}

export default function AuthorsPage() {
  const authors = buildAuthorList();

  return (
    <>
      <Header />
      <main className="py-16 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Authors</h1>
          <p className="text-lg text-gray-700 mb-8">Meet the contributors behind our articles.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {authors.map((author) => (
              <Link
                key={author.slug}
                href={`/authors/${author.slug}`}
                className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-primary-300 transition-colors"
              >
                <h2 className="text-xl font-semibold text-gray-900">{author.name}</h2>
                <p className="text-sm text-gray-700 mt-2">{author.posts} published article{author.posts === 1 ? '' : 's'}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
