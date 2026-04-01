import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { generateMetadata } from '@/lib/metadata';

export const revalidate = 86400; // 24 hours

export const metadata = generateMetadata({
  title: 'Subscribe to The Corporate Blog Newsletter',
  description: 'Get the latest insights on technology, business, and innovation delivered to your inbox weekly. Subscribe to our newsletter.',
  canonical: '/newsletter',
});

export default function NewsletterPage() {
  return (
    <>
      <Header />
      <main className="py-16 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* Breadcrumbs */}
          <nav className="text-sm text-gray-600 mb-8">
            <Link href="/" className="hover:text-primary-700">Home</Link>
            <span> / </span>
            <span>Newsletter</span>
          </nav>

          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">Stay Updated</h1>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto">
              Get the latest insights on technology, business, and innovation delivered to your inbox every week.
            </p>
          </div>

          {/* Newsletter Form */}
          <div className="bg-white border border-gray-200 rounded-lg p-8 mb-12 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscribe Today</h2>
            <p className="text-gray-600 mb-6">Join thousands of readers getting expert insights and analysis.</p>

            <form className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Your name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Topics of Interest</p>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" name="topics" value="technology" className="mr-2" />
                    <span className="text-gray-700">Technology & Innovation</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" name="topics" value="business" className="mr-2" />
                    <span className="text-gray-700">Business & Strategy</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" name="topics" value="industry" className="mr-2" />
                    <span className="text-gray-700">Industry Analysis</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-primary-600 text-white font-semibold py-3 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Subscribe Now
              </button>
            </form>

            <p className="text-xs text-gray-500 mt-4">
              We respect your privacy. Unsubscribe at any time. See our{' '}
              <a href="#" className="text-primary-600 hover:text-primary-700">
                Privacy Policy
              </a>
              .
            </p>
          </div>

          {/* Benefits Section */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">What You'll Get</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-4xl mb-4">📰</div>
                <h3 className="font-semibold text-gray-900 mb-2">Weekly Insights</h3>
                <p className="text-gray-600 text-sm">
                  Curated articles and analysis delivered every week covering the latest industry trends.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="font-semibold text-gray-900 mb-2">Expert Take</h3>
                <p className="text-gray-600 text-sm">
                  Get expert commentary and deep dives from industry leaders and thought leaders.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="font-semibold text-gray-900 mb-2">Actionable Tips</h3>
                <p className="text-gray-600 text-sm">
                  Learn practical strategies and tactics you can implement immediately.
                </p>
              </div>
            </div>
          </section>

          {/* Social Proof / Stats */}
          <section className="bg-primary-50 border border-primary-200 rounded-lg p-8 mb-12 text-center">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-3xl font-bold text-primary-600">50K+</p>
                <p className="text-gray-700">Subscribers</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary-600">98%</p>
                <p className="text-gray-700">Open Rate</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary-600">4.8★</p>
                <p className="text-gray-700">Rating</p>
              </div>
            </div>
          </section>

          {/* Archive Section */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Newsletter Archive</h2>
            <p className="text-gray-600 mb-4">
              Check out some of our past newsletters below to see what you'll receive:
            </p>
            <div className="space-y-3">
              <a href="#" className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors">
                <p className="font-semibold text-gray-900">Latest in AI & Machine Learning</p>
                <p className="text-sm text-gray-600">Published Dec 15, 2024</p>
              </a>
              <a href="#" className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors">
                <p className="font-semibold text-gray-900">2024 Tech Industry Trends Recap</p>
                <p className="text-sm text-gray-600">Published Dec 8, 2024</p>
              </a>
              <a href="#" className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors">
                <p className="font-semibold text-gray-900">Cloud Infrastructure Best Practices</p>
                <p className="text-sm text-gray-600">Published Dec 1, 2024</p>
              </a>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
