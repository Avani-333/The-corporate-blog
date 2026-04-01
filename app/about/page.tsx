import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { generateMetadata } from '@/lib/metadata';

export const revalidate = 86400; // 24 hours

export const metadata = generateMetadata({
  title: 'About The Corporate Blog - Production-Grade Blogging Platform',
  description: 'Learn about The Corporate Blog, a production-grade, SEO-first blogging platform built to scale to millions of daily active users.',
  canonical: '/about',
});

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="py-16 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* Breadcrumbs */}
          <nav className="text-sm text-gray-600 mb-8">
            <Link href="/" className="hover:text-primary-700">Home</Link>
            <span> / </span>
            <span>About</span>
          </nav>

          {/* Hero Section */}
          <div className="mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">About The Corporate Blog</h1>
            <p className="text-xl text-gray-700 leading-relaxed">
              The Corporate Blog is a production-grade, SEO-first blogging platform built from the ground up to scale to 1M+ Daily Active Users. It combines cutting-edge technology with a focus on content quality and search visibility.
            </p>
          </div>

          {/* Mission Section */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h2>
            <p className="text-gray-700 mb-4">
              We believe that great content deserves a platform built to perform. The Corporate Blog provides:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-primary-600 mr-3">✓</span>
                <span>SEO-first architecture that helps content rank higher in search engines</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-600 mr-3">✓</span>
                <span>Serverless, scalable infrastructure designed for growth</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-600 mr-3">✓</span>
                <span>Role-based access control for teams of any size</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-600 mr-3">✓</span>
                <span>Advanced analytics and performance monitoring</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-600 mr-3">✓</span>
                <span>Monetization infrastructure ready from day one</span>
              </li>
            </ul>
          </section>

          {/* Technology Section */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Built on Modern Technology</h2>
            <p className="text-gray-700 mb-4">
              The Corporate Blog leverages the latest technologies to deliver exceptional performance:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Frontend</h3>
                <p className="text-sm text-gray-600">Next.js, React, TypeScript, and Tailwind CSS for a responsive, type-safe user experience.</p>
              </div>
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Backend</h3>
                <p className="text-sm text-gray-600">Express.js, Node.js, and PostgreSQL for reliable, scalable API infrastructure.</p>
              </div>
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Deployment</h3>
                <p className="text-sm text-gray-600">Vercel and Railway for global CDN, automatic scaling, and zero-downtime deployments.</p>
              </div>
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Monitoring</h3>
                <p className="text-sm text-gray-600">Sentry, uptime monitoring, and alert policies for 99.9% reliability.</p>
              </div>
            </div>
          </section>

          {/* Values Section */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Values</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Performance First</h3>
                <p className="text-gray-700">Every feature is optimized for speed. We aim for 90+ Lighthouse scores and sub-second load times.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">SEO Excellence</h3>
                <p className="text-gray-700">Structured data, semantic HTML, and optimization best practices are built into every page.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Security & Privacy</h3>
                <p className="text-gray-700">Industry-standard security practices, encryption, and compliance with data privacy regulations.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Accessibility</h3>
                <p className="text-gray-700">WCAG 2.1 AA compliance ensures the platform is usable by everyone.</p>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="bg-primary-50 border border-primary-200 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Get Started?</h2>
            <p className="text-gray-700 mb-6">
              Explore our blog, sign up for updates, or get in touch with our team.
            </p>
            <div className="flex gap-4">
              <Link
                href="/blog"
                className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Read Our Blog
              </Link>
              <Link
                href="/contact"
                className="inline-block border border-primary-600 text-primary-600 px-6 py-2 rounded-lg hover:bg-primary-50 transition-colors"
              >
                Contact Us
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
