import { type SEOMetadata } from './seo';
import { load } from 'cheerio';
import {
  validateFAQRichResultEligibility,
  validateAuthorEEATSchemaIntegrity,
} from './schema-validation';

// ============================================================================
// SEO VALIDATION INTERFACES
// ============================================================================

export interface SEOValidationResult {
  score: number; // 0-100
  passed: number;
  total: number;
  checklist: SEOChecklistItem[];
  recommendations: string[];
  errors: string[];
  warnings: string[];
}

export interface SEOChecklistItem {
  category: 'basic' | 'openGraph' | 'twitter' | 'structured' | 'technical' | 'content';
  item: string;
  required: boolean;
  passed: boolean;
  value?: string;
  recommendation?: string;
  impact: 'high' | 'medium' | 'low';
}

export interface PageAnalysis {
  url: string;
  title?: string;
  description?: string;
  h1Tags: string[];
  h2Tags: string[];
  images: ImageAnalysis[];
  links: LinkAnalysis[];
  metaTags: Record<string, string>;
  structuredData: any[];
  performance?: PerformanceMetrics;
}

export interface ImageAnalysis {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  hasAltText: boolean;
  isOptimized: boolean;
}

export interface LinkAnalysis {
  href: string;
  text: string;
  isInternal: boolean;
  hasTitle: boolean;
  isNoFollow: boolean;
}

export interface PerformanceMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
}

export interface InternalLinkDistributionMetrics {
  totalInternalLinks: number;
  uniqueInternalTargets: number;
  topTarget?: string;
  topTargetCount: number;
  topTargetShare: number;
}

const GENERIC_ANCHOR_PATTERNS = [
  /^click here$/i,
  /^read more$/i,
  /^learn more$/i,
  /^here$/i,
  /^more$/i,
  /^details$/i,
  /^this$/i,
  /^link$/i,
];

function isActionableInternalHref(href: string): boolean {
  if (!href) return false;
  const lower = href.toLowerCase();
  return !(
    lower.startsWith('#') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('javascript:')
  );
}

function getInternalLinkDepth(href: string, pageUrl: string): number {
  try {
    const parsed = new URL(href, pageUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments.length;
  } catch {
    return 0;
  }
}

export function measureInternalLinkDistribution(analysis: PageAnalysis): InternalLinkDistributionMetrics {
  const internalLinks = analysis.links.filter((link) => link.isInternal && isActionableInternalHref(link.href));
  const targetCount = new Map<string, number>();

  internalLinks.forEach((link) => {
    const key = link.href.split('#')[0];
    targetCount.set(key, (targetCount.get(key) || 0) + 1);
  });

  const sortedTargets = Array.from(targetCount.entries()).sort((a, b) => b[1] - a[1]);
  const topTarget = sortedTargets[0]?.[0];
  const topTargetCount = sortedTargets[0]?.[1] || 0;
  const totalInternalLinks = internalLinks.length;

  return {
    totalInternalLinks,
    uniqueInternalTargets: targetCount.size,
    topTarget,
    topTargetCount,
    topTargetShare: totalInternalLinks > 0 ? topTargetCount / totalInternalLinks : 0,
  };
}

// ============================================================================
// SEO VALIDATION FUNCTIONS
// ============================================================================

export function validateBasicMetaTags(metadata: SEOMetadata): SEOChecklistItem[] {
  const checks: SEOChecklistItem[] = [];
  
  // Title validation
  checks.push({
    category: 'basic',
    item: 'Title tag present',
    required: true,
    passed: !!metadata.title,
    value: metadata.title,
    recommendation: !metadata.title ? 'Add a unique, descriptive title tag' : undefined,
    impact: 'high'
  });
  
  checks.push({
    category: 'basic',
    item: 'Title length (50-60 characters)',
    required: true,
    passed: metadata.title ? metadata.title.length >= 30 && metadata.title.length <= 60 : false,
    value: metadata.title ? `${metadata.title.length} characters` : undefined,
    recommendation: metadata.title && (metadata.title.length < 30 || metadata.title.length > 60) 
      ? 'Optimize title length to 50-60 characters for better display in search results' 
      : undefined,
    impact: 'medium'
  });
  
  // Description validation  
  checks.push({
    category: 'basic',
    item: 'Meta description present',
    required: true,
    passed: !!metadata.description,
    value: metadata.description,
    recommendation: !metadata.description ? 'Add a compelling meta description' : undefined,
    impact: 'high'
  });
  
  checks.push({
    category: 'basic',
    item: 'Meta description length (150-160 characters)',
    required: true,
    passed: metadata.description ? metadata.description.length >= 120 && metadata.description.length <= 160 : false,
    value: metadata.description ? `${metadata.description.length} characters` : undefined,
    recommendation: metadata.description && (metadata.description.length < 120 || metadata.description.length > 160)
      ? 'Optimize description length to 150-160 characters'
      : undefined,
    impact: 'medium'
  });
  
  // Canonical URL
  checks.push({
    category: 'basic',
    item: 'Canonical URL present',
    required: true,
    passed: !!metadata.canonical,
    value: metadata.canonical,
    recommendation: !metadata.canonical ? 'Add canonical URL to prevent duplicate content issues' : undefined,
    impact: 'high'
  });
  
  // Keywords
  checks.push({
    category: 'basic',
    item: 'Keywords present',
    required: false,
    passed: !!(metadata.keywords && metadata.keywords.length > 0),
    value: metadata.keywords?.join(', '),
    recommendation: !metadata.keywords?.length ? 'Consider adding relevant keywords for better content categorization' : undefined,
    impact: 'low'
  });
  
  // Robots
  checks.push({
    category: 'basic',
    item: 'Robots directive present',
    required: true,
    passed: !!metadata.robots,
    value: metadata.robots,
    recommendation: !metadata.robots ? 'Add robots meta tag to control search engine crawling' : undefined,
    impact: 'medium'
  });
  
  return checks;
}

export function validateOpenGraphTags(metadata: SEOMetadata): SEOChecklistItem[] {
  const checks: SEOChecklistItem[] = [];
  const og = metadata.openGraph;
  
  if (!og) {
    checks.push({
      category: 'openGraph',
      item: 'Open Graph data present',
      required: true,
      passed: false,
      recommendation: 'Add Open Graph meta tags for better social sharing',
      impact: 'high'
    });
    return checks;
  }
  
  // Required OG tags
  checks.push({
    category: 'openGraph',
    item: 'OG title present',
    required: true,
    passed: !!og.title,
    value: og.title,
    recommendation: !og.title ? 'Add Open Graph title for social sharing' : undefined,
    impact: 'high'
  });
  
  checks.push({
    category: 'openGraph',
    item: 'OG description present',
    required: true,
    passed: !!og.description,
    value: og.description,
    recommendation: !og.description ? 'Add Open Graph description for social sharing' : undefined,
    impact: 'high'
  });
  
  checks.push({
    category: 'openGraph',
    item: 'OG type present',
    required: true,
    passed: !!og.type,
    value: og.type,
    recommendation: !og.type ? 'Add Open Graph type (website, article, etc.)' : undefined,
    impact: 'medium'
  });
  
  checks.push({
    category: 'openGraph',
    item: 'OG URL present',
    required: true,
    passed: !!og.url,
    value: og.url,
    recommendation: !og.url ? 'Add Open Graph URL for social sharing' : undefined,
    impact: 'medium'
  });
  
  checks.push({
    category: 'openGraph',
    item: 'OG image present',
    required: true,
    passed: !!(og.images && og.images.length > 0),
    value: og.images?.[0]?.url,
    recommendation: !og.images?.length ? 'Add Open Graph image (1200x630px recommended)' : undefined,
    impact: 'high'
  });
  
  // Image optimization
  if (og.images && og.images.length > 0) {
    const image = og.images[0];
    checks.push({
      category: 'openGraph',
      item: 'OG image size optimized',
      required: false,
      passed: !!(image.width === 1200 && image.height === 630),
      value: image.width && image.height ? `${image.width}x${image.height}` : 'Unknown',
      recommendation: !(image.width === 1200 && image.height === 630) 
        ? 'Use 1200x630px for optimal social sharing display'
        : undefined,
      impact: 'medium'
    });
    
    checks.push({
      category: 'openGraph',
      item: 'OG image alt text',
      required: false,
      passed: !!image.alt,
      value: image.alt,
      recommendation: !image.alt ? 'Add alt text to Open Graph image for accessibility' : undefined,
      impact: 'low'
    });
  }
  
  checks.push({
    category: 'openGraph',
    item: 'OG site name present',
    required: false,
    passed: !!og.siteName,
    value: og.siteName,
    recommendation: !og.siteName ? 'Add site name for consistent branding in social shares' : undefined,
    impact: 'low'
  });
  
  return checks;
}

export function validateTwitterTags(metadata: SEOMetadata): SEOChecklistItem[] {
  const checks: SEOChecklistItem[] = [];
  const twitter = metadata.twitter;
  
  if (!twitter) {
    checks.push({
      category: 'twitter',
      item: 'Twitter Card data present',
      required: true,
      passed: false,
      recommendation: 'Add Twitter Card meta tags for better Twitter sharing',
      impact: 'medium'
    });
    return checks;
  }
  
  checks.push({
    category: 'twitter',
    item: 'Twitter card type',
    required: true,
    passed: !!twitter.card,
    value: twitter.card,
    recommendation: !twitter.card ? 'Add Twitter card type (summary_large_image recommended)' : undefined,
    impact: 'medium'
  });
  
  checks.push({
    category: 'twitter',
    item: 'Twitter site handle',
    required: false,
    passed: !!twitter.site,
    value: twitter.site,
    recommendation: !twitter.site ? 'Add site Twitter handle for attribution' : undefined,
    impact: 'low'
  });
  
  checks.push({
    category: 'twitter',
    item: 'Twitter image present',
    required: true,
    passed: !!twitter.image,
    value: twitter.image,
    recommendation: !twitter.image ? 'Add Twitter sharing image' : undefined,
    impact: 'medium'
  });
  
  checks.push({
    category: 'twitter',
    item: 'Twitter image alt text',
    required: false,
    passed: !!twitter.imageAlt,
    value: twitter.imageAlt,
    recommendation: !twitter.imageAlt ? 'Add alt text to Twitter image for accessibility' : undefined,
    impact: 'low'
  });
  
  return checks;
}

export function validateStructuredData(metadata: SEOMetadata): SEOChecklistItem[] {
  const checks: SEOChecklistItem[] = [];
  
  checks.push({
    category: 'structured',
    item: 'Structured data present',
    required: true,
    passed: !!(metadata.structuredData && metadata.structuredData.length > 0),
    value: metadata.structuredData ? `${metadata.structuredData.length} schema(s)` : undefined,
    recommendation: !metadata.structuredData?.length ? 'Add structured data (JSON-LD) for rich snippets' : undefined,
    impact: 'high'
  });
  
  if (metadata.structuredData && metadata.structuredData.length > 0) {
    const hasOrganization = metadata.structuredData.some(schema => schema['@type'] === 'Organization');
    checks.push({
      category: 'structured',
      item: 'Organization schema',
      required: false,
      passed: hasOrganization,
      recommendation: !hasOrganization ? 'Add Organization schema for entity recognition' : undefined,
      impact: 'medium'
    });
    
    const hasWebsite = metadata.structuredData.some(schema => schema['@type'] === 'WebSite');
    checks.push({
      category: 'structured',
      item: 'Website schema',
      required: false,
      passed: hasWebsite,
      recommendation: !hasWebsite ? 'Add Website schema with site search functionality' : undefined,
      impact: 'medium'
    });
    
    const hasArticle = metadata.structuredData.some(schema => schema['@type'] === 'Article');
    const hasBreadcrumb = metadata.structuredData.some(schema => schema['@type'] === 'BreadcrumbList');
    
    if (metadata.openGraph?.type === 'article') {
      checks.push({
        category: 'structured',
        item: 'Article schema (for blog posts)',
        required: true,
        passed: hasArticle,
        recommendation: !hasArticle ? 'Add Article schema for blog posts to enable rich snippets' : undefined,
        impact: 'high'
      });
    }
    
    checks.push({
      category: 'structured',
      item: 'Breadcrumb schema',
      required: false,
      passed: hasBreadcrumb,
      recommendation: !hasBreadcrumb ? 'Add BreadcrumbList schema for better navigation understanding' : undefined,
      impact: 'low'
    });
  }
  
  return checks;
}

export function validateTechnicalSEO(metadata: SEOMetadata, url?: string): SEOChecklistItem[] {
  const checks: SEOChecklistItem[] = [];
  
  // HTTPS check (if URL provided)
  if (url) {
    const isHTTPS = url.startsWith('https://');
    checks.push({
      category: 'technical',
      item: 'HTTPS enabled',
      required: true,
      passed: isHTTPS,
      value: isHTTPS ? 'Secure' : 'Not secure',
      recommendation: !isHTTPS ? 'Enable HTTPS for security and SEO benefits' : undefined,
      impact: 'high'
    });
  }
  
  // Viewport meta tag
  checks.push({
    category: 'technical',
    item: 'Viewport meta tag',
    required: true,
    passed: !!metadata.viewport,
    value: metadata.viewport || 'width=device-width, initial-scale=1',
    recommendation: !metadata.viewport ? 'Add viewport meta tag for mobile responsiveness' : undefined,
    impact: 'high'
  });
  
  // Theme color
  checks.push({
    category: 'technical',
    item: 'Theme color meta tag',
    required: false,
    passed: !!metadata.themeColor,
    value: metadata.themeColor,
    recommendation: !metadata.themeColor ? 'Add theme color for better mobile browser experience' : undefined,
    impact: 'low'
  });
  
  // Favicon
  checks.push({
    category: 'technical',
    item: 'Favicon specified',
    required: true,
    passed: !!metadata.favicon,
    value: metadata.favicon,
    recommendation: !metadata.favicon ? 'Add favicon for brand recognition' : undefined,
    impact: 'low'
  });
  
  // Apple touch icon
  checks.push({
    category: 'technical',
    item: 'Apple touch icon',
    required: false,
    passed: !!metadata.appleTouchIcon,
    value: metadata.appleTouchIcon,
    recommendation: !metadata.appleTouchIcon ? 'Add Apple touch icon for iOS home screen' : undefined,
    impact: 'low'
  });
  
  return checks;
}

// ============================================================================
// HTML ANALYSIS
// ============================================================================

export function analyzeHTMLContent(html: string, url: string): PageAnalysis {
  const $ = load(html);
  
  // Extract basic information
  const title = $('title').text();
  const description = $('meta[name="description"]').attr('content');
  
  // Extract heading structure
  const h1Tags = $('h1').map((_, el) => $(el).text().trim()).get();
  const h2Tags = $('h2').map((_, el) => $(el).text().trim()).get();
  
  // Analyze images
  const images: ImageAnalysis[] = $('img').map((_, el) => {
    const $img = $(el);
    const src = $img.attr('src') || '';
    const alt = $img.attr('alt');
    const width = parseInt($img.attr('width') || '0');
    const height = parseInt($img.attr('height') || '0');
    
    return {
      src,
      alt,
      width: width || undefined,
      height: height || undefined,
      hasAltText: !!alt,
      isOptimized: !!(width && height) // Basic optimization check
    };
  }).get();
  
  // Analyze links
  const links: LinkAnalysis[] = $('a[href]').map((_, el) => {
    const $link = $(el);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();
    const title = $link.attr('title');
    const rel = $link.attr('rel') || '';
    
    return {
      href,
      text,
      isInternal: href.startsWith('/') || href.includes(new URL(url).hostname),
      hasTitle: !!title,
      isNoFollow: rel.includes('nofollow')
    };
  }).get();
  
  // Extract meta tags
  const metaTags: Record<string, string> = {};
  $('meta').each((_, el) => {
    const $meta = $(el);
    const name = $meta.attr('name') || $meta.attr('property') || '';
    const content = $meta.attr('content') || '';
    if (name && content) {
      metaTags[name] = content;
    }
  });
  
  // Extract structured data
  const structuredData: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      structuredData.push(data);
    } catch (error) {
      // Invalid JSON-LD, skip
    }
  });
  
  return {
    url,
    title,
    description,
    h1Tags,
    h2Tags,
    images,
    links,
    metaTags,
    structuredData
  };
}

// ============================================================================
// COMPREHENSIVE SEO VALIDATION
// ============================================================================

export function validatePageSEO(metadata: SEOMetadata, html?: string, url?: string): SEOValidationResult {
  const allChecks: SEOChecklistItem[] = [
    ...validateBasicMetaTags(metadata),
    ...validateOpenGraphTags(metadata),
    ...validateTwitterTags(metadata),
    ...validateStructuredData(metadata),
    ...validateTechnicalSEO(metadata, url)
  ];
  
  // Add HTML-specific checks if HTML provided
  if (html && url) {
    const analysis = analyzeHTMLContent(html, url);
    allChecks.push(...validateContentStructure(analysis));

    const faqValidation = validateFAQRichResultEligibility(html);
    allChecks.push({
      category: 'structured',
      item: 'FAQ rich result eligibility',
      required: false,
      passed: faqValidation.eligible,
      value: faqValidation.issues.length
        ? faqValidation.issues.map((issue) => issue.code).join(', ')
        : 'Eligible',
      recommendation: faqValidation.issues[0]?.message,
      impact: faqValidation.eligible ? 'low' : 'high',
    });

    const authorValidation = validateAuthorEEATSchemaIntegrity(html);
    allChecks.push({
      category: 'structured',
      item: 'Author E-E-A-T schema integrity',
      required: true,
      passed: authorValidation.eligible,
      value: authorValidation.issues.length
        ? authorValidation.issues.map((issue) => issue.code).join(', ')
        : 'Valid',
      recommendation: authorValidation.issues[0]?.message,
      impact: authorValidation.eligible ? 'low' : 'high',
    });
  }
  
  const passed = allChecks.filter(check => check.passed).length;
  const total = allChecks.length;
  const score = Math.round((passed / total) * 100);
  
  const recommendations: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  allChecks.forEach(check => {
    if (!check.passed) {
      if (check.recommendation) {
        if (check.required && check.impact === 'high') {
          errors.push(check.recommendation);
        } else if (check.impact === 'medium') {
          warnings.push(check.recommendation);
        } else {
          recommendations.push(check.recommendation);
        }
      }
    }
  });
  
  return {
    score,
    passed,
    total,
    checklist: allChecks,
    recommendations,
    errors,
    warnings
  };
}

export function validateContentStructure(analysis: PageAnalysis): SEOChecklistItem[] {
  const checks: SEOChecklistItem[] = [];
  
  // H1 tag validation
  checks.push({
    category: 'content',
    item: 'Single H1 tag present',
    required: true,
    passed: analysis.h1Tags.length === 1,
    value: analysis.h1Tags.length > 0 ? analysis.h1Tags[0] : 'No H1 found',
    recommendation: analysis.h1Tags.length === 0 
      ? 'Add a single H1 tag for the main page heading'
      : analysis.h1Tags.length > 1
      ? 'Use only one H1 tag per page'
      : undefined,
    impact: 'high'
  });
  
  // H2 tags for structure
  checks.push({
    category: 'content',
    item: 'Content structure with H2 tags',
    required: false,
    passed: analysis.h2Tags.length > 0,
    value: `${analysis.h2Tags.length} H2 tags`,
    recommendation: analysis.h2Tags.length === 0 ? 'Add H2 tags for better content structure' : undefined,
    impact: 'medium'
  });
  
  // Image alt text
  const imagesWithoutAlt = analysis.images.filter(img => !img.hasAltText);
  checks.push({
    category: 'content',
    item: 'All images have alt text',
    required: true,
    passed: imagesWithoutAlt.length === 0,
    value: `${analysis.images.length - imagesWithoutAlt.length}/${analysis.images.length} images with alt text`,
    recommendation: imagesWithoutAlt.length > 0 ? 'Add alt text to all images for accessibility and SEO' : undefined,
    impact: 'high'
  });
  
  // Internal links
  const internalLinks = analysis.links.filter(link => link.isInternal);
  checks.push({
    category: 'content',
    item: 'Internal linking present',
    required: false,
    passed: internalLinks.length > 0,
    value: `${internalLinks.length} internal links`,
    recommendation: internalLinks.length === 0 ? 'Add internal links to improve site navigation and SEO' : undefined,
    impact: 'medium'
  });

  // Anchor text quality validation
  const weakAnchorLinks = internalLinks.filter(link => {
    const anchor = link.text.trim().toLowerCase();
    if (!anchor) return true;
    return GENERIC_ANCHOR_PATTERNS.some((pattern) => pattern.test(anchor));
  });

  checks.push({
    category: 'content',
    item: 'Anchor text is descriptive',
    required: true,
    passed: weakAnchorLinks.length === 0,
    value: `${internalLinks.length - weakAnchorLinks.length}/${internalLinks.length} descriptive anchors`,
    recommendation: weakAnchorLinks.length > 0
      ? 'Replace generic anchors (for example "click here") with descriptive, topic-specific text.'
      : undefined,
    impact: 'high'
  });

  // Click depth validation (target URL path depth from home <= 3)
  const deepInternalLinks = internalLinks
    .filter(link => isActionableInternalHref(link.href))
    .map(link => ({
      href: link.href,
      depth: getInternalLinkDepth(link.href, analysis.url),
    }))
    .filter(link => link.depth > 3);

  checks.push({
    category: 'content',
    item: 'Internal depth <= 3 clicks',
    required: false,
    passed: deepInternalLinks.length === 0,
    value: deepInternalLinks.length > 0
      ? `${deepInternalLinks.length} links deeper than 3`
      : 'All internal links within 3 clicks',
    recommendation: deepInternalLinks.length > 0
      ? 'Reduce deep internal paths by surfacing important pages within 3-click navigation depth.'
      : undefined,
    impact: 'medium'
  });

  // Internal link distribution metrics/check
  const distribution = measureInternalLinkDistribution(analysis);
  const hasHealthyDistribution =
    distribution.totalInternalLinks === 0 ||
    (distribution.uniqueInternalTargets >= 3 && distribution.topTargetShare <= 0.5);

  checks.push({
    category: 'content',
    item: 'Internal link distribution measured',
    required: false,
    passed: true,
    value: `${distribution.uniqueInternalTargets} unique targets, top share ${(distribution.topTargetShare * 100).toFixed(1)}%`,
    impact: 'low'
  });

  checks.push({
    category: 'content',
    item: 'Internal link distribution is balanced',
    required: false,
    passed: hasHealthyDistribution,
    value: distribution.topTarget ? `Top target: ${distribution.topTarget}` : 'No internal links',
    recommendation: !hasHealthyDistribution
      ? 'Distribute internal links across multiple relevant destinations instead of repeatedly linking the same target.'
      : undefined,
    impact: 'medium'
  });
  
  return checks;
}

// ============================================================================
// SEO AUDIT RUNNER
// ============================================================================

export async function runSEOAudit(
  url: string, 
  metadata: SEOMetadata,
  fetchHTML?: () => Promise<string>
): Promise<SEOValidationResult> {
  let html: string | undefined;
  
  try {
    if (fetchHTML) {
      html = await fetchHTML();
    }
  } catch (error) {
    console.warn('Could not fetch HTML for analysis:', error);
  }
  
  const result = validatePageSEO(metadata, html, url);
  console.log(`SEO Audit Complete: ${result.score}/100 (${result.passed}/${result.total} checks passed)`);
  
  return result;
}

// ============================================================================
// SEO REPORT GENERATOR
// ============================================================================

export function generateSEOReport(result: SEOValidationResult): string {
  const report = [`
# SEO Audit Report

**Overall Score: ${result.score}/100**
**Checks Passed: ${result.passed}/${result.total}**

## Summary
${result.score >= 90 ? '✅ Excellent SEO optimization!' : 
  result.score >= 70 ? '⚠️ Good SEO with room for improvement' :
  result.score >= 50 ? '🔶 Moderate SEO - needs attention' :
  '❌ Poor SEO - requires immediate action'}

`];

  if (result.errors.length > 0) {
    report.push('## 🚨 Critical Issues (High Impact)\n');
    result.errors.forEach(error => {
      report.push(`- ${error}\n`);
    });
    report.push('\n');
  }

  if (result.warnings.length > 0) {
    report.push('## ⚠️ Warnings (Medium Impact)\n');
    result.warnings.forEach(warning => {
      report.push(`- ${warning}\n`);
    });
    report.push('\n');
  }

  if (result.recommendations.length > 0) {
    report.push('## 💡 Recommendations (Low Impact)\n');
    result.recommendations.forEach(rec => {
      report.push(`- ${rec}\n`);
    });
    report.push('\n');
  }

  // Detailed checklist by category
  const categories = ['basic', 'openGraph', 'twitter', 'structured', 'technical', 'content'] as const;
  
  categories.forEach(category => {
    const categoryChecks = result.checklist.filter(check => check.category === category);
    if (categoryChecks.length === 0) return;
    
    const categoryName = {
      basic: 'Basic Meta Tags',
      openGraph: 'Open Graph',
      twitter: 'Twitter Cards',
      structured: 'Structured Data',
      technical: 'Technical SEO',
      content: 'Content Structure'
    }[category];
    
    report.push(`## ${categoryName}\n\n`);
    
    categoryChecks.forEach(check => {
      const status = check.passed ? '✅' : '❌';
      const value = check.value ? ` (${check.value})` : '';
      report.push(`${status} ${check.item}${value}\n`);
    });
    
    report.push('\n');
  });

  return report.join('');
}