'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Search, ChevronDown } from 'lucide-react';
import { SearchModal } from '@/components/ui/SearchModal';
import AuthButton from '@/components/auth/AuthButton';
import { publicCategories } from '@/lib/content-index';

const categories = publicCategories.map(({ name, slug }) => ({ name, slug }));

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-900 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">TCB</span>
                </div>
                <span className="text-xl font-bold text-gray-900 hidden sm:block">
                  The Corporate Blog
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <Link 
                href="/blog" 
                className="text-gray-700 hover:text-primary-700 font-medium transition-colors py-2"
              >
                Latest
              </Link>
              
              <div className="relative">
                <button
                  onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
                  className="flex items-center space-x-1 text-gray-700 hover:text-primary-700 font-medium transition-colors py-2"
                >
                  <span>Categories</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {isCategoriesOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    {categories.map((category) => (
                      <Link
                        key={category.slug}
                        href={`/categories/${category.slug}`}
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors"
                        onClick={() => setIsCategoriesOpen(false)}
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              
              <Link 
                href="/about" 
                className="text-gray-700 hover:text-primary-700 font-medium transition-colors py-2"
              >
                About
              </Link>
            </nav>

            {/* Search & CTA */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
              
              <Link
                href="/newsletter"
                className="hidden sm:inline-flex btn-primary"
              >
                Subscribe
              </Link>

              <AuthButton />

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 text-gray-600 hover:text-primary-600 transition-colors"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200">
              <nav className="flex flex-col space-y-4">
                <Link 
                  href="/blog" 
                  className="text-gray-700 hover:text-primary-600 font-medium py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Latest Articles
                </Link>
                
                <div className="border-l-2 border-gray-200 pl-4">
                  <p className="text-sm font-medium text-gray-500 mb-2">Categories</p>
                  {categories.map((category) => (
                    <Link
                      key={category.slug}
                      href={`/categories/${category.slug}`}
                      className="block text-gray-700 hover:text-primary-600 py-1"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
                
                <Link 
                  href="/about" 
                  className="text-gray-700 hover:text-primary-600 font-medium py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  About
                </Link>
                
                <Link
                  href="/newsletter"
                  className="btn-primary w-fit"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Subscribe to Newsletter
                </Link>
                
                <div className="pt-2">
                  <AuthButton />
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}