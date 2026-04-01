import { NextRequest, NextResponse } from 'next/server';
import { featuredPublicPosts } from '@/lib/content-index';

function scoreResult(query: string, title: string, excerpt: string, categoryName: string): number {
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

export async function GET(request: NextRequest) {
  const requestId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `search_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const sort = (searchParams.get('sort') || 'relevance').toLowerCase() === 'date' ? 'date' : 'relevance';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('limit') || '10', 10) || 10));
  
  try {
    const scored = query
      ? featuredPublicPosts
          .map((post) => ({
            id: post.id,
            title: post.title,
            excerpt: post.excerpt,
            slug: post.slug,
            categoryName: post.categoryName,
            categorySlug: post.categorySlug,
            publishedAt: post.publishedAt,
            readingTime: post.readingTime,
            score: scoreResult(query, post.title, post.excerpt, post.categoryName),
          }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => {
            if (sort === 'date') {
              return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
            }

            if (b.score !== a.score) return b.score - a.score;
            return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
          })
      : [];

    const total = scored.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const end = start + limit;
    const results = scored.slice(start, end);

    return NextResponse.json(
      {
      success: true,
      data: {
        requestId,
        query,
        sort,
        results,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': query
            ? 'public, max-age=120, s-maxage=300, stale-while-revalidate=600'
            : 'public, max-age=300, s-maxage=600, stale-while-revalidate=1200',
        },
      }
    );
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}