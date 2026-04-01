'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { PublicPost } from '@/lib/content-index';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { trackSearchEvent } from '@/lib/search-analytics';

interface SearchResultsListProps {
  results: PublicPost[];
  query: string;
}

export function SearchResultsList({ results, query }: SearchResultsListProps) {
  const normalizedQuery = query.trim();
  const lastLoadEventKeyRef = useRef('');

  useEffect(() => {
    if (!normalizedQuery) return;

    const eventKey = `${normalizedQuery.toLowerCase()}|${results.length}|search_results_page`;
    if (lastLoadEventKeyRef.current === eventKey) return;

    trackSearchEvent('search_results_loaded', {
      surface: 'search_results_page',
      query: normalizedQuery,
      queryLength: normalizedQuery.length,
      resultCount: results.length,
      hasResults: results.length > 0,
      resultIds: results.slice(0, 20).map((result) => result.slug),
      interactionMode: 'full_results',
      sort: 'relevance',
      page: 1,
      limit: 10,
    });

    lastLoadEventKeyRef.current = eventKey;
  }, [normalizedQuery, results]);

  return (
    <div
      className="space-y-4"
      itemScope
      itemType="https://schema.org/ItemList"
      itemProp="mainEntity"
    >
      <meta itemProp="name" content={normalizedQuery ? `Search results for ${normalizedQuery}` : 'Search results'} />
      <meta itemProp="numberOfItems" content={String(results.length)} />
      {results.map((post, index) => (
        <article
          key={post.slug}
          className="bg-white rounded-xl border border-gray-200 p-6"
          itemProp="itemListElement"
          itemScope
          itemType="https://schema.org/ListItem"
        >
          <meta itemProp="position" content={String(index + 1)} />
          <div itemProp="item" itemScope itemType="https://schema.org/Article">
            <meta itemProp="url" content={`/blog/${post.slug}`} />
            <meta itemProp="datePublished" content={post.publishedAt} />
            <meta itemProp="author" content={post.authorName} />
            <meta itemProp="articleSection" content={post.categoryName} />

            <p className="text-sm text-primary-700 mb-2">
              <Link href={`/categories/${post.categorySlug}`}>
                <HighlightedText text={post.categoryName} query={normalizedQuery} />
              </Link>
            </p>
            <h2 className="text-xl font-semibold text-gray-900 mb-2" itemProp="headline">
              <Link
                href={`/blog/${post.slug}`}
                onClick={() => {
                  if (!normalizedQuery) return;
                  trackSearchEvent('search_result_clicked', {
                    surface: 'search_results_page',
                    query: normalizedQuery,
                    queryLength: normalizedQuery.length,
                    resultCount: results.length,
                    position: index + 1,
                    resultSlug: post.slug,
                    sort: 'relevance',
                    page: 1,
                    limit: 10,
                  });
                }}
              >
                <HighlightedText text={post.title} query={normalizedQuery} />
              </Link>
            </h2>
            <p className="text-gray-600" itemProp="description">
              <HighlightedText text={post.excerpt} query={normalizedQuery} />
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
