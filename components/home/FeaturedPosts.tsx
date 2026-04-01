import Link from 'next/link';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { featuredPublicPosts } from '@/lib/content-index';

const featuredPosts = featuredPublicPosts;

export function FeaturedPosts() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {featuredPosts.map((post, index) => (
        <article
          key={post.id}
          className={`card hover:shadow-lg transition-all duration-300 group ${
            index === 0 ? 'md:col-span-2 lg:col-span-1' : ''
          }`}
        >
          {/* Featured Image */}
          <div className="relative overflow-hidden rounded-t-lg">
            <div className="aspect-[16/10] bg-gradient-to-br from-gray-200 to-gray-300 relative">
              {/* Placeholder for now - replace with actual Image component when images are available */}
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center mb-2 mx-auto">
                    <span className="text-2xl">📖</span>
                  </div>
                  <p className="text-sm font-medium">Featured Image</p>
                </div>
              </div>
              
              {/* Category Badge */}
              <div className="absolute top-4 left-4">
                <span 
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    post.categoryColor === 'blue' ? 'bg-blue-100 text-blue-800' :
                    post.categoryColor === 'green' ? 'bg-green-100 text-green-800' :
                    'bg-purple-100 text-purple-800'
                  }`}
                >
                  <Link href={`/categories/${post.categorySlug}`}>
                    {post.categoryName}
                  </Link>
                </span>
              </div>
            </div>
            
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>

          {/* Content */}
          <div className="card-body">
            <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{post.readingTime} min read</span>
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors line-clamp-2">
              <Link href={`/blog/${post.slug}`}>
                {post.title}
              </Link>
            </h3>

            <p className="text-gray-600 mb-4 line-clamp-3">
              {post.excerpt}
            </p>

            {/* Author & Read More */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {post.authorName.split(' ').map((n) => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {post.authorName}
                  </p>
                </div>
              </div>

              <Link
                href={`/blog/${post.slug}`}
                className="btn-ghost text-sm group/link"
              >
                Read More
                <ArrowRight className="ml-1 w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}