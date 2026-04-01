/**
 * PostPreview
 *
 * Full-featured preview pane that renders the post exactly as a reader
 * would see it on the published blog.  Includes:
 *   - Responsive viewport selector (desktop / tablet / mobile)
 *   - Featured image, title, author, date, tags, excerpt
 *   - Block content rendered via BlockRenderer in readonly mode
 *   - SEO preview panel (title tag, URL, meta description)
 *   - Block validation issue overlay
 */

'use client';

import { useMemo, useState } from 'react';
import {
  X,
  Monitor,
  Tablet,
  Smartphone,
  Search,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { BlockRenderer } from './blocks/BlockRenderer';
import { EditorState, EditorAction, createInitialEditorState } from '@/lib/editor-state';
import { BlockValidationIssue, ValidationSeverity } from '@/lib/block-validation';
import { URL_CONSTANTS } from '@/lib/url-utils';

// ============================================================================
// TYPES
// ============================================================================

type Viewport = 'desktop' | 'tablet' | 'mobile';

interface PostPreviewProps {
  /** Post data to preview */
  post: {
    title: string;
    slug: string;
    excerpt: string;
    content: any; // ArticleContent or { blocks: any[] }
    featuredImage?: string;
    featuredImageAlt?: string;
    seoTitle?: string;
    seoDescription?: string;
    categories?: any[];
    tags?: any[];
    status?: string;
    wordCount?: number;
    readingTime?: number;
  };
  /** Validation issues to display */
  validationIssues?: BlockValidationIssue[];
  /** Counts of validation issues */
  validationCounts?: { errors: number; warnings: number; info: number };
  /** Callback to close the preview */
  onClose: () => void;
  /** Callback when user clicks on a block error (scrolls to block in editor) */
  onBlockClick?: (blockId: string) => void;
  /** Site URL for SEO preview */
  siteUrl?: string;
}

// ============================================================================
// VIEWPORT SETTINGS
// ============================================================================

const VIEWPORT_CONFIG: Record<Viewport, { label: string; width: string; icon: typeof Monitor }> = {
  desktop: { label: 'Desktop', width: 'max-w-4xl', icon: Monitor },
  tablet: { label: 'Tablet', width: 'max-w-2xl', icon: Tablet },
  mobile: { label: 'Mobile', width: 'max-w-sm', icon: Smartphone },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function PostPreview({
  post,
  validationIssues = [],
  validationCounts,
  onClose,
  onBlockClick,
  siteUrl = 'https://thecorporateblog.com',
}: PostPreviewProps) {
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [showSeoPanel, setShowSeoPanel] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  // ---- Derived ----
  const blocks = useMemo(() => {
    if (Array.isArray(post.content?.blocks)) return post.content.blocks;
    if (Array.isArray(post.content)) return post.content;
    return [];
  }, [post.content]);

  const effectiveTitle = post.seoTitle || post.title || 'Untitled';
  const effectiveDescription = post.seoDescription || post.excerpt || '';
  const fullUrl = `${siteUrl}${URL_CONSTANTS.BLOG}/${post.slug || 'untitled'}`;
  const readingTime = post.readingTime || Math.max(1, Math.ceil((post.wordCount || 0) / 200));

  const errorCount = validationCounts?.errors ?? validationIssues.filter((i) => i.severity === 'error').length;
  const warningCount = validationCounts?.warnings ?? validationIssues.filter((i) => i.severity === 'warning').length;

  // Build a minimal EditorState for BlockRenderer's readonly prop
  const dummyState = useMemo(() => createInitialEditorState(), []);
  const noopAction = (_: EditorAction) => {};

  const vpConfig = VIEWPORT_CONFIG[viewport];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-100">
      {/* ================================================================ */}
      {/* TOOLBAR                                                          */}
      {/* ================================================================ */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 shrink-0">
        {/* Left: title */}
        <div className="flex items-center gap-3">
          <Eye className="w-5 h-5 text-primary-600" />
          <span className="text-sm font-semibold text-gray-900">Preview</span>
          <span className="text-xs text-gray-400 hidden sm:inline">
            {post.title ? `— ${post.title}` : ''}
          </span>
        </div>

        {/* Center: viewport selector */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(Object.keys(VIEWPORT_CONFIG) as Viewport[]).map((vp) => {
            const Icon = VIEWPORT_CONFIG[vp].icon;
            return (
              <button
                key={vp}
                onClick={() => setViewport(vp)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewport === vp
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                aria-label={VIEWPORT_CONFIG[vp].label}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{VIEWPORT_CONFIG[vp].label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Validation badge */}
          {validationIssues.length > 0 && (
            <button
              onClick={() => setShowValidation(!showValidation)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                errorCount > 0
                  ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                  : warningCount > 0
                    ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {errorCount > 0 ? (
                <AlertCircle className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              {errorCount > 0 && <span>{errorCount} error{errorCount !== 1 ? 's' : ''}</span>}
              {warningCount > 0 && <span>{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>}
            </button>
          )}

          {/* SEO preview toggle */}
          <button
            onClick={() => setShowSeoPanel(!showSeoPanel)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              showSeoPanel
                ? 'border-primary-200 bg-primary-50 text-primary-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SEO</span>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ================================================================ */}
      {/* SEO PREVIEW PANEL                                                */}
      {/* ================================================================ */}
      {showSeoPanel && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <div className="mx-auto max-w-2xl">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Google Search Preview
            </p>
            <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
              {/* Title */}
              <h3
                className={`text-lg leading-snug font-normal font-sans ${
                  effectiveTitle.length > 60 ? 'text-red-700' : 'text-[#1a0dab]'
                }`}
              >
                {effectiveTitle || 'Page Title'}
                {effectiveTitle.length > 60 && (
                  <span className="inline-block ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded font-medium align-middle">
                    {effectiveTitle.length}/60
                  </span>
                )}
              </h3>
              {/* URL */}
              <p className="text-sm text-[#006621] mt-0.5 truncate font-sans">
                {fullUrl}
              </p>
              {/* Description */}
              <p
                className={`text-sm mt-1 leading-relaxed font-sans ${
                  effectiveDescription.length > 160 ? 'text-red-600' : 'text-[#545454]'
                }`}
              >
                {effectiveDescription || 'No description set.'}
                {effectiveDescription.length > 160 && (
                  <span className="inline-block ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded font-medium align-middle">
                    {effectiveDescription.length}/160
                  </span>
                )}
              </p>
            </div>

            {/* Quick SEO stats */}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>Title: {(post.seoTitle || post.title || '').length}/60</span>
              <span>Description: {(post.seoDescription || post.excerpt || '').length}/160</span>
              <span>Slug: {(post.slug || '').length} chars</span>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* VALIDATION PANEL                                                 */}
      {/* ================================================================ */}
      {showValidation && validationIssues.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0 max-h-60 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Validation Issues ({validationIssues.length})
            </p>
            {validationIssues.map((issue, i) => (
              <button
                key={`${issue.blockId}-${issue.rule}-${i}`}
                onClick={() => issue.blockId && onBlockClick?.(issue.blockId)}
                className={`w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  issue.severity === 'error'
                    ? 'bg-red-50 text-red-800 hover:bg-red-100'
                    : issue.severity === 'warning'
                      ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                }`}
              >
                <SeverityIcon severity={issue.severity} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{issue.blockLabel || 'Post'}</span>
                  {issue.blockIndex >= 0 && (
                    <span className="text-xs opacity-60 ml-1">Block {issue.blockIndex + 1}</span>
                  )}
                  <span className="mx-1 opacity-40">·</span>
                  <span>{issue.message}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* PREVIEW CONTENT                                                  */}
      {/* ================================================================ */}
      <div className="flex-1 overflow-y-auto py-8">
        <div className={`mx-auto ${vpConfig.width} transition-all duration-300`}>
          <article className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Featured Image */}
            {post.featuredImage && (
              <div className="aspect-[2/1] relative overflow-hidden bg-gray-100">
                <img
                  src={post.featuredImage}
                  alt={post.featuredImageAlt || post.title || 'Featured image'}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Article Header */}
            <div className="px-6 sm:px-10 pt-8 pb-6">
              {/* Categories */}
              {post.categories && post.categories.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  {post.categories.map((cat: any, i: number) => (
                    <span
                      key={cat.id ?? i}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700"
                    >
                      {cat.name ?? cat}
                    </span>
                  ))}
                </div>
              )}

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
                {post.title || <span className="text-gray-300 italic">Untitled post</span>}
              </h1>

              {/* Excerpt */}
              {post.excerpt && (
                <p className="text-lg text-gray-600 leading-relaxed mb-6">
                  {post.excerpt}
                </p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-4 text-sm text-gray-500 border-b border-gray-100 pb-6">
                <time>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
                <span>·</span>
                <span>{readingTime} min read</span>
                <span>·</span>
                <span>{post.wordCount ?? 0} words</span>
              </div>
            </div>

            {/* Article Body — Blocks */}
            <div className="px-6 sm:px-10 pb-10">
              <div className="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-primary-600 prose-img:rounded-lg">
                {blocks.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <p className="text-lg">No content blocks yet.</p>
                    <p className="text-sm mt-1">Add blocks in the editor to see them here.</p>
                  </div>
                ) : (
                  blocks.map((block: any) => (
                    <div
                      key={block.id}
                      className={`relative group ${
                        validationIssues.some((i) => i.blockId === block.id && i.severity === 'error')
                          ? 'ring-2 ring-red-300 ring-offset-2 rounded-lg'
                          : ''
                      }`}
                    >
                      <BlockRenderer
                        block={block}
                        state={dummyState}
                        onAction={noopAction}
                        readonly
                      />

                      {/* Error indicator dot */}
                      {validationIssues.some((i) => i.blockId === block.id && i.severity === 'error') && (
                        <div className="absolute -left-3 top-1 w-2 h-2 rounded-full bg-red-500" title="This block has validation errors" />
                      )}
                      {validationIssues.some((i) => i.blockId === block.id && i.severity === 'warning') &&
                       !validationIssues.some((i) => i.blockId === block.id && i.severity === 'error') && (
                        <div className="absolute -left-3 top-1 w-2 h-2 rounded-full bg-amber-400" title="This block has warnings" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="px-6 sm:px-10 pb-8 border-t border-gray-100 pt-6">
                <div className="flex items-center gap-2 flex-wrap">
                  {post.tags.map((tag: any, i: number) => (
                    <span
                      key={tag.id ?? i}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      #{tag.name ?? tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </article>

          {/* URL bar */}
          <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm">
            <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-gray-400 truncate">{fullUrl}</span>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* FOOTER STATUS BAR                                                */}
      {/* ================================================================ */}
      <footer className="h-8 px-4 flex items-center justify-between border-t border-gray-200 bg-white text-xs text-gray-500 shrink-0">
        <div className="flex items-center gap-4">
          <span>{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
          <span>{post.wordCount ?? 0} words</span>
          <span>~{readingTime} min read</span>
        </div>
        <div className="flex items-center gap-3">
          {errorCount > 0 && <span className="text-red-600 font-medium">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>}
          {warningCount > 0 && <span className="text-amber-600 font-medium">{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>}
          {errorCount === 0 && warningCount === 0 && (
            <span className="text-green-600 font-medium">No issues</span>
          )}
          <span className="capitalize">{viewport} view</span>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// SEVERITY ICON
// ============================================================================

function SeverityIcon({ severity }: { severity: ValidationSeverity }) {
  switch (severity) {
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
    case 'info':
      return <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />;
  }
}
