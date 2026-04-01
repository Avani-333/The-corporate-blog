import Link from 'next/link';
import { ArrowRight, TrendingUp, Users, Award } from 'lucide-react';

const stats = [
  { icon: TrendingUp, label: 'Monthly Readers', value: '50K+' },
  { icon: Users, label: 'Active Writers', value: '25+' },
  { icon: Award, label: 'Industry Awards', value: '5' },
];

export function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-gray-50 via-white to-primary-50 pt-16 pb-20 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-primary-100 rounded-full opacity-20"></div>
        <div className="absolute top-40 -left-32 w-80 h-80 bg-secondary-100 rounded-full opacity-20"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-4xl mx-auto">
          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            The Corporate Blog
            <span className="block text-gradient mt-2">
              Built for Scale
            </span>
          </h1>

          {/* Description */}
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Production-grade, SEO-first blogging platform delivering insights on technology, 
            business, and innovation. Join thousands of readers discovering the future.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link
              href="/blog"
              className="btn-primary text-lg px-8 py-3 flex items-center group"
            >
              Explore Articles
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <Link
              href="/newsletter"
              className="btn-secondary text-lg px-8 py-3"
            >
              Subscribe Newsletter
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl mx-auto">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-sm mb-3">
                    <Icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-gray-600">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 320"
          className="w-full h-20 fill-current text-white"
        >
          <path d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,122.7C672,117,768,139,864,138.7C960,139,1056,117,1152,117.3C1248,117,1344,139,1392,149.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>
    </section>
  );
}