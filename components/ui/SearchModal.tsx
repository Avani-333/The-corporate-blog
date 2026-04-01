'use client';

import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { trackSearchEvent } from '@/lib/search-analytics';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  categoryName: string;
}

const recentSearches = [
  'Next.js App Router',
  'TypeScript best practices',
  'AI in business',
  'Remote work tools',
  'Startup funding',
];

const trendingTopics = [
  { term: 'Machine Learning', count: '234 articles' },
  { term: 'Web Development', count: '189 articles' },
  { term: 'Digital Marketing', count: '156 articles' },
  { term: 'Data Science', count: '142 articles' },
  { term: 'Cryptocurrency', count: '98 articles' },
];

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const sort: 'relevance' | 'date' = 'relevance';
  const [requestId, setRequestId] = useState<string | undefined>(undefined);
  const lastLoadEventKeyRef = useRef('');

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleSearch = async (searchQuery: string, signal?: AbortSignal) => {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      setResults([]);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(normalizedQuery)}&limit=6&sort=relevance`, {
        signal,
      });

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const payload = await response.json();
      const apiResults = Array.isArray(payload?.data?.results) ? payload.data.results : [];
      setRequestId(payload?.data?.requestId);
      setResults(apiResults);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setResults([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const debounceTimer = setTimeout(() => {
      void handleSearch(query, controller.signal);
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(debounceTimer);
    };
  }, [query]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!isOpen || !normalizedQuery || isLoading) return;

    const timer = window.setTimeout(() => {
      trackSearchEvent('search_preview_viewed', {
        surface: 'search_modal',
        query: normalizedQuery,
        queryLength: normalizedQuery.length,
        resultCount: results.length,
        sort,
        page: 1,
        limit: 6,
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [isLoading, isOpen, query, results.length, sort]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!isOpen || !normalizedQuery || isLoading) return;

    const eventKey = `${normalizedQuery.toLowerCase()}|${results.length}|search_modal`;
    if (lastLoadEventKeyRef.current === eventKey) return;

    trackSearchEvent('search_results_loaded', {
      surface: 'search_modal',
      query: normalizedQuery,
      queryLength: normalizedQuery.length,
      resultCount: results.length,
      hasResults: results.length > 0,
      resultIds: results.slice(0, 20).map((result: SearchResult) => result.slug),
      requestId,
      interactionMode: 'preview',
      sort,
      page: 1,
      limit: 6,
    });

    lastLoadEventKeyRef.current = eventKey;
  }, [isLoading, isOpen, query, requestId, results, sort]);

  const normalizedQuery = query.trim();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-start justify-center p-4 pt-16">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100vh-8rem)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center p-6 border-b border-gray-200">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search articles, topics, or authors..."
                className="w-full pl-12 pr-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={query}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {query && isLoading && (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Searching...</p>
              </div>
            )}

            {query && !isLoading && results.length > 0 && (
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Search Results
                </h3>
                <div className="space-y-3">
                  {results.map((result: SearchResult, index: number) => (
                    <Link
                      key={result.id}
                      href={`/blog/${result.slug}`}
                      onClick={() => {
                        trackSearchEvent('search_result_clicked', {
                          surface: 'search_modal',
                          query: normalizedQuery,
                          queryLength: normalizedQuery.length,
                          resultCount: results.length,
                          position: index + 1,
                          resultSlug: result.slug,
                          sort,
                          page: 1,
                          limit: 6,
                        });
                        onClose();
                      }}
                      className="block p-4 rounded-xl hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 group-hover:text-primary-600 mb-1">
                            <HighlightedText text={result.title} query={query} />
                          </h4>
                          <p className="text-gray-600 text-sm line-clamp-2">
                            <HighlightedText text={result.excerpt} query={query} />
                          </p>
                          <span className="inline-block mt-2 px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full">
                            <HighlightedText text={result.categoryName || 'General'} query={query} />
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <Link
                    href={`/search?q=${encodeURIComponent(query)}`}
                    onClick={() => {
                      trackSearchEvent('search_submitted', {
                        surface: 'search_modal',
                        query: normalizedQuery,
                        queryLength: normalizedQuery.length,
                        resultCount: results.length,
                        sort,
                        page: 1,
                        limit: 10,
                      });
                      onClose();
                    }}
                    className="text-sm font-medium text-primary-700 hover:text-primary-900"
                  >
                    View full results for "{query}"
                  </Link>
                </div>
              </div>
            )}

            {query && !isLoading && results.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-gray-600">No results found for "{query}"</p>
                <p className="text-sm text-gray-500 mt-1">
                  Try different keywords or browse our categories
                </p>
              </div>
            )}

            {!query && (
              <div className="p-6 space-y-8">
                {/* Recent Searches */}
                <div>
                  <h3 className="flex items-center text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    <Clock className="w-4 h-4 mr-2" />
                    Recent Searches
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term, index) => (
                      <button
                        key={index}
                        onClick={() => setQuery(term)}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trending Topics */}
                <div>
                  <h3 className="flex items-center text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Trending Topics
                  </h3>
                  <div className="space-y-2">
                    {trendingTopics.map((topic, index) => (
                      <button
                        key={index}
                        onClick={() => setQuery(topic.term)}
                        className="flex items-center justify-between w-full p-3 text-left hover:bg-gray-50 rounded-lg transition-colors group"
                      >
                        <span className="font-medium text-gray-900 group-hover:text-primary-600">
                          {topic.term}
                        </span>
                        <span className="text-sm text-gray-500">
                          {topic.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
            <p className="text-xs text-gray-500">
              Press <kbd className="px-2 py-1 bg-white rounded shadow text-xs">ESC</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}