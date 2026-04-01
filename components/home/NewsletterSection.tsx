import { Mail, CheckCircle, Star } from 'lucide-react';

const benefits = [
  'Weekly curated content digest',
  'Exclusive industry insights',
  'Early access to new articles',
  'No spam, unsubscribe anytime',
];

const testimonials = [
  {
    text: "The best tech newsletter I've ever subscribed to. Always relevant and actionable.",
    author: 'Alex Chen',
    role: 'Senior Developer',
  },
  {
    text: "Incredible insights that have helped shape our company's strategy.",
    author: 'Sarah Johnson', 
    role: 'Product Manager',
  },
  {
    text: "A must-read for anyone in the tech industry. Consistently high quality.",
    author: 'Mike Rodriguez',
    role: 'Tech Lead',
  },
];

export function NewsletterSection() {
  return (
    <section className="py-16 bg-gradient-to-r from-primary-600 to-primary-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center text-white">
          {/* Header */}
          <div className="mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-6">
              <Mail className="w-8 h-8" />
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Join 10,000+ Industry Leaders
            </h2>
            
            <p className="text-xl text-primary-100 max-w-2xl mx-auto">
              Get weekly insights on technology, business strategy, and innovation 
              delivered directly to your inbox.
            </p>
          </div>

          {/* Newsletter Form */}
          <div className="bg-white rounded-2xl p-8 mb-12 max-w-2xl mx-auto">
            <form className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
                <button
                  type="submit"
                  className="btn-primary whitespace-nowrap px-8 py-3"
                >
                  Subscribe Free
                </button>
              </div>
              
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Free forever</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>No spam</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Unsubscribe anytime</span>
                </div>
              </div>
            </form>

            {/* Benefits */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                What you'll get:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Social Proof */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
              ))}
            </div>
            <p className="text-primary-100">
              Rated 4.9/5 by 2,000+ subscribers
            </p>
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-left"
              >
                <div className="flex items-center space-x-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                
                <blockquote className="text-primary-50 mb-4 italic">
                  "{testimonial.text}"
                </blockquote>
                
                <div>
                  <cite className="text-white font-medium not-italic">
                    {testimonial.author}
                  </cite>
                  <p className="text-primary-200 text-sm">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 pt-8 border-t border-primary-500/30">
            <p className="text-primary-200 text-sm">
              Trusted by professionals at Google, Microsoft, Amazon, and 500+ other companies
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}