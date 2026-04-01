import Link from 'next/link';
import { 
  Code, 
  TrendingUp, 
  Lightbulb, 
  Rocket, 
  Users, 
  BarChart,
  ArrowRight
} from 'lucide-react';
import { publicCategories } from '@/lib/content-index';

const categories = publicCategories;

const iconBySlug = {
  technology: Code,
  business: TrendingUp,
  innovation: Lightbulb,
  startup: Rocket,
  leadership: Users,
  analytics: BarChart,
} as const;

const colorMap = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    title: 'text-blue-900',
    hover: 'hover:bg-blue-100',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
    title: 'text-green-900',
    hover: 'hover:bg-green-100',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: 'text-purple-600',
    title: 'text-purple-900',
    hover: 'hover:bg-purple-100',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: 'text-orange-600',
    title: 'text-orange-900',
    hover: 'hover:bg-orange-100',
  },
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    icon: 'text-indigo-600',
    title: 'text-indigo-900',
    hover: 'hover:bg-indigo-100',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
    title: 'text-red-900',
    hover: 'hover:bg-red-100',
  },
};

export function CategoryGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {categories.map((category) => {
        const Icon = iconBySlug[category.slug as keyof typeof iconBySlug] || Code;
        const colors = colorMap[category.color as keyof typeof colorMap];
        
        return (
          <Link
            key={category.slug}
            href={`/categories/${category.slug}`}
            className={`
              group relative p-6 rounded-xl border-2 transition-all duration-300
              ${colors.bg} ${colors.border} ${colors.hover}
              hover:shadow-lg hover:scale-105 hover:-translate-y-1
            `}
          >
            {/* Trending Badge */}
            {category.trending && (
              <div className="absolute -top-2 -right-2 px-2 py-1 bg-red-700 text-white text-xs font-semibold rounded-full">
                Trending
              </div>
            )}

            {/* Icon */}
            <div className={`inline-flex p-3 rounded-lg bg-white shadow-sm mb-4 ${colors.icon}`}>
              <Icon className="w-6 h-6" />
            </div>

            {/* Content */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className={`text-xl font-bold ${colors.title}`}>
                  {category.name}
                </h3>
                <ArrowRight className={`w-5 h-5 ${colors.icon} group-hover:translate-x-1 transition-transform`} />
              </div>
              
              <p className="text-gray-600 text-sm leading-relaxed">
                {category.description}
              </p>
              
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-700">
                  {category.postCount} articles
                </span>
                <span className={`text-sm font-medium ${colors.title}`}>
                  Explore →
                </span>
              </div>
            </div>

            {/* Hover Effect Background */}
            <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </Link>
        );
      })}
    </div>
  );
}