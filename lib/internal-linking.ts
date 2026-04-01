import { featuredPublicPosts, type PublicPost } from '@/lib/content-index';

interface LinkEngineInput {
  postSlug?: string;
  title?: string;
  excerpt?: string;
  categorySlug?: string;
  tags?: string[];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4)
  );
}

function scoreRelatedness(target: LinkEngineInput, candidate: PublicPost): number {
  let score = 0;

  if (target.categorySlug && target.categorySlug === candidate.categorySlug) {
    score += 30;
  }

  const targetTokens = tokenize(`${target.title || ''} ${target.excerpt || ''} ${(target.tags || []).join(' ')}`);
  const candidateTokens = tokenize(`${candidate.title} ${candidate.excerpt} ${candidate.categoryName}`);

  let overlap = 0;
  for (const token of targetTokens) {
    if (candidateTokens.has(token)) overlap += 1;
  }

  score += overlap * 5;

  // Prefer fresher posts when relevance is equal.
  const ageMs = Date.now() - new Date(candidate.publishedAt).getTime();
  const ageDays = Math.max(1, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
  score += Math.max(0, 20 - Math.floor(ageDays / 30));

  return score;
}

export function getRelatedPosts(input: LinkEngineInput, limit = 3): PublicPost[] {
  return [...featuredPublicPosts]
    .filter((post) => post.slug !== input.postSlug)
    .map((post) => ({ post, score: scoreRelatedness(input, post) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.post);
}

export function getPopularPosts(limit = 3): PublicPost[] {
  return [...featuredPublicPosts]
    .sort((a, b) => {
      const aScore = (a.readingTime || 0) + a.title.length / 10;
      const bScore = (b.readingTime || 0) + b.title.length / 10;
      return bScore - aScore;
    })
    .slice(0, limit);
}

export function getInternalLinkSuggestions(input: LinkEngineInput, limit = 5): Array<{ anchorText: string; href: string }> {
  const related = getRelatedPosts(input, limit);
  return related.map((post) => ({
    anchorText: post.title,
    href: `/blog/${post.slug}`,
  }));
}
