'use client';

import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { PublicPost } from '@/lib/content-index';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { trackSearchEvent } from '@/lib/search-analytics';

interface SearchInputWithPreviewProps {
  initialQuery: string;
  posts: PublicPost[];
}

function scorePost(query: string, title: string, excerpt: string, categoryName: string): number {
  const normalized = query.toLowerCase();
  let score = 0;

  if (title.toLowerCase().includes(normalized)) score += 10;
  if (categoryName.toLowerCase().includes(normalized)) score += 6;
  if (excerpt.toLowerCase().includes(normalized)) score += 3;

  const terms = normalized.split(/\s+/).filter(Boolean);
  for (const term of terms) {
    if (title.toLowerCase().includes(term)) score += 2;
    if (excerpt.toLowerCase().includes(term)) score += 1;
  }

  return score;
}

export function SearchInputWithPreview({ initialQuery, posts }: SearchInputWithPreviewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const lastPreviewEventKeyRef = useRef('');

  const previewResults = useMemo(() => {
    if (!query.trim()) return [];

    return posts
      .map((post) => ({ post, score: scorePost(query, post.title, post.excerpt, post.categoryName) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((entry) => entry.post);
  }, [query, posts]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!isOpen || !normalizedQuery) return;

    const eventKey = `${normalizedQuery.toLowerCase()}|${previewResults.length}`;
    if (lastPreviewEventKeyRef.current === eventKey) return;

    const timer = window.setTimeout(() => {
      trackSearchEvent('search_preview_viewed', {
        surface: 'search_page',
        query: normalizedQuery,
        queryLength: normalizedQuery.length,
        resultCount: previewResults.length,
      });
      lastPreviewEventKeyRef.current = eventKey;
    }, 200);

    return () => window.clearTimeout(timer);
  }, [isOpen, previewResults.length, query]);

  const normalizedQuery = query.trim();

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!normalizedQuery || previewResults.length === 0) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev: number) => (prev + 1) % previewResults.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev: number) => (prev <= 0 ? previewResults.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0 && activeIndex < previewResults.length) {
      event.preventDefault();
      const selected = previewResults[activeIndex];
      window.location.href = `/blog/${selected.slug}`;
    }
  };

  return (
    <form
      action="/search"
      className="mb-8 relative"
      role="search"
      onSubmit={() => {
        if (!normalizedQuery) return;
        trackSearchEvent('search_submitted', {
          surface: 'search_page',
          query: normalizedQuery,
          queryLength: normalizedQuery.length,
          resultCount: previewResults.length,
          sort: 'relevance',
          page: 1,
          limit: 10,
        });
      }}
    >
      <div className="relative">
        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 120);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search topics, authors, or article titles"
          className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 text-gray-900"
          autoComplete="off"
        />
      </div>

      {isOpen && normalizedQuery && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          {previewResults.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto">
              {previewResults.map((post: PublicPost, index: number) => (
                <li key={post.slug} className="border-b border-gray-100 last:border-b-0">
                  <Link
                    href={`/blog/${post.slug}`}
                    onClick={() => {
                      trackSearchEvent('search_result_clicked', {
                        surface: 'search_page',
                        query: normalizedQuery,
                        queryLength: normalizedQuery.length,
                        resultCount: previewResults.length,
                        position: index + 1,
                        resultSlug: post.slug,
                      });
                    }}
                    className={`block px-4 py-3 transition-colors ${
                      activeIndex === index ? 'bg-primary-50' : 'hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <p className="text-xs text-primary-700 mb-1">
                      <HighlightedText text={post.categoryName} query={query} />
                    </p>
                    <p className="font-medium text-gray-900 line-clamp-1">
                      <HighlightedText text={post.title} query={query} />
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                      <HighlightedText text={post.excerpt} query={query} />
                    </p>
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="submit"
                  className="w-full px-4 py-3 text-left text-sm font-medium text-primary-700 hover:bg-primary-50 transition-colors"
                >
                  View all results for "{query}"
                </button>
              </li>
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-600">No quick matches. Press Enter to search all articles.</div>
          )}
        </div>
      )}
    </form>
  );
}
