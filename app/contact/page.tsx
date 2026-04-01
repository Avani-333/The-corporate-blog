import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { generateMetadata } from '@/lib/metadata';

export const revalidate = 86400; // 24 hours

export const metadata = generateMetadata({
  title: 'Contact The Corporate Blog - Get In Touch',
  description: 'Have questions about The Corporate Blog? We\'d love to hear from you. Get in touch with our team.',
  canonical: '/contact',
});

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="py-16 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* Breadcrumbs */}
          <nav className="text-sm text-gray-600 mb-8">
            <Link href="/" className="hover:text-primary-700">Home</Link>
            <span> / </span>
            <span>Contact</span>
          </nav>

          {/* Hero Section */}
          <div className="mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">Get In Touch</h1>
            <p className="text-xl text-gray-700">
              Have questions about The Corporate Blog? We'd love to hear from you. Reach out to our team.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Email */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-primary-600 text-3xl mb-4">✉️</div>
              <h3 className="font-semibold text-gray-900 mb-2">Email</h3>
              <p className="text-gray-600 mb-4">Get in touch via email for any inquiries.</p>
              <a
                href="mailto:hello@corporateblog.com"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                hello@corporateblog.com
              </a>
            </div>

            {/* Support */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-primary-600 text-3xl mb-4">💬</div>
              <h3 className="font-semibold text-gray-900 mb-2">Support</h3>
              <p className="text-gray-600 mb-4">Need technical support? We're here to help.</p>
              <a
                href="mailto:support@corporateblog.com"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                support@corporateblog.com
              </a>
            </div>

            {/* Sales */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-primary-600 text-3xl mb-4">📞</div>
              <h3 className="font-semibold text-gray-900 mb-2">Sales</h3>
              <p className="text-gray-600 mb-4">Interested in enterprise plans? Let's talk.</p>
              <a
                href="mailto:sales@corporateblog.com"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                sales@corporateblog.com
              </a>
            </div>
          </div>

          {/* Contact Form Section */}
          <section className="bg-white border border-gray-200 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Send us a Message</h2>
            <form className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Your name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  placeholder="What is this about?"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={6}
                  placeholder="Tell us what's on your mind..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  required
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full bg-primary-600 text-white font-semibold py-3 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Send Message
              </button>
            </form>
            <p className="text-sm text-gray-600 mt-4">
              We typically respond within 24 hours. For urgent matters, please email support@corporateblog.com.
            </p>
          </section>

          {/* FAQ Section */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <details className="bg-white border border-gray-200 rounded-lg p-6">
                <summary className="cursor-pointer font-semibold text-gray-900 select-none">
                  What is The Corporate Blog?
                </summary>
                <p className="text-gray-700 mt-4">
                  The Corporate Blog is a production-grade, SEO-first blogging platform designed to scale to 1M+ Daily Active Users.
                </p>
              </details>

              <details className="bg-white border border-gray-200 rounded-lg p-6">
                <summary className="cursor-pointer font-semibold text-gray-900 select-none">
                  How much does it cost?
                </summary>
                <p className="text-gray-700 mt-4">
                  We offer flexible pricing plans for individuals and enterprises. Contact our sales team for custom quotes.
                </p>
              </details>

              <details className="bg-white border border-gray-200 rounded-lg p-6">
                <summary className="cursor-pointer font-semibold text-gray-900 select-none">
                  Is there a free trial?
                </summary>
                <p className="text-gray-700 mt-4">
                  Yes! Sign up for a free account to explore all features. No credit card required.
                </p>
              </details>

              <details className="bg-white border border-gray-200 rounded-lg p-6">
                <summary className="cursor-pointer font-semibold text-gray-900 select-none">
                  What about data security?
                </summary>
                <p className="text-gray-700 mt-4">
                  We implement industry-standard security practices including encryption, regular backups, and compliance with GDPR and CCPA.
                </p>
              </details>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
