import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { featuredPublicPosts } from '@/lib/content-index';
import { generateMetadata as buildMetadata } from '@/lib/metadata';

interface AuthorPageProps {
  params: {
    slug: string;
  };
}

function getAuthorBySlug(slug: string) {
  const normalized = slug === 'admin' ? 'sarah-chen' : slug;
  const posts = featuredPublicPosts.filter((post) => post.authorSlug === normalized);

  if (posts.length === 0) {
    return null;
  }

  return {
    slug: normalized,
    name: posts[0].authorName,
    posts,
  };
}

export function generateStaticParams() {
  const unique = Array.from(new Set(featuredPublicPosts.map((post) => post.authorSlug)));
  return [{ slug: 'admin' }, ...unique.map((slug) => ({ slug }))];
}

export function generateMetadata({ params }: AuthorPageProps) {
  const author = getAuthorBySlug(params.slug);

  if (!author) {
    return buildMetadata({
      title: 'Author Not Found - The Corporate Blog',
      description: 'The requested author does not exist.',
      canonical: `/authors/${params.slug}`,
      noIndex: true,
    });
  }

  return buildMetadata({
    title: `${author.name} - Author at The Corporate Blog`,
    description: `Read articles written by ${author.name}.`,
    canonical: `/authors/${params.slug}`,
  });
}

export default function AuthorPage({ params }: AuthorPageProps) {
  const author = getAuthorBySlug(params.slug);

  if (!author) {
    notFound();
  }

  return (
    <>
      <Header />
      <main className="py-16 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <nav className="text-sm text-gray-600 mb-6">
            <Link href="/" className="hover:text-primary-700">Home</Link>
            <span> / </span>
            <Link href="/authors" className="hover:text-primary-700">Authors</Link>
            <span> / </span>
            <span>{author.name}</span>
          </nav>

          <h1 className="text-4xl font-bold text-gray-900 mb-3">{author.name}</h1>
          <p className="text-lg text-gray-700 mb-8">{author.posts.length} published article{author.posts.length === 1 ? '' : 's'}</p>

          <div className="space-y-4">
            {author.posts.map((post) => (
              <article key={post.slug} className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm text-primary-700 mb-2">{post.categoryName}</p>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  <Link href={`/blog/${post.slug}`} className="hover:text-primary-700">
                    {post.title}
                  </Link>
                </h2>
                <p className="text-gray-700 mb-2">{post.excerpt}</p>
                <p className="text-sm text-gray-700">{new Date(post.publishedAt).toLocaleDateString()} • {post.readingTime} min read</p>
              </article>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
