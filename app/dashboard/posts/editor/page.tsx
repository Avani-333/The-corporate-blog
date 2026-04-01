'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { withRoleProtection } from '@/hooks/useRoleBasedUI';
import { PostEditor } from '@/components/editor/PostEditor';
import { EditorSidebar } from '@/components/editor/EditorSidebar';
import { SlugPreview } from '@/components/editor/SlugPreview';
import { PostPreview } from '@/components/editor/PostPreview';
import { useRoleBasedUI } from '@/hooks/useRoleBasedUI';
import { useAutoSave, AutoSaveStatus } from '@/hooks/useAutoSave';
import { useBlockValidation } from '@/hooks/useBlockValidation';
import { canPublishImmediately, needsApprovalToPublish, getAvailablePostStatuses } from '@/lib/rbac';
import { trackPublishEvent } from '@/lib/analytics-events';
import { UserRole, PostStatus } from '@/types';
import {
  Save,
  Eye,
  Settings,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Wifi,
  WifiOff,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// TYPES
// ============================================================================

interface DraftPost {
  id: string;
  title: string;
  slug: string;
  content: any;
  contentHtml: string;
  excerpt: string;
  status: string;
  featuredImage: string;
  featuredImageAlt: string;
  seoTitle: string;
  seoDescription: string;
  categories: any[];
  tags: any[];
  wordCount: number;
  readingTime: number;
  scheduledAt: string;
  version: number;
  is_sponsored?: boolean;
  affiliateLinkVia?: string | null;
  enforceDisclosureBanner?: boolean;
  highlightAffiliateLinks?: boolean;
}

const EMPTY_POST: DraftPost = {
  id: '',
  title: '',
  slug: '',
  content: null,
  contentHtml: '',
  excerpt: '',
  status: 'DRAFT',
  featuredImage: '',
  featuredImageAlt: '',
  seoTitle: '',
  seoDescription: '',
  categories: [],
  tags: [],
  wordCount: 0,
  readingTime: 0,
  scheduledAt: '',
  version: 1,
  is_sponsored: false,
  affiliateLinkVia: null,
  enforceDisclosureBanner: false,
  highlightAffiliateLinks: false,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function EditorPageComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rbac = useRoleBasedUI();
  const postId = searchParams.get('id');
  const isEdit = !!postId;

  // ---- State ----
  const [post, setPost] = useState<DraftPost>(() => ({
    ...EMPTY_POST,
    id: postId || '',
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Stable ref for the latest post data (used by auto-save closure)
  const postRef = useRef(post);
  postRef.current = post;

  // ---- RBAC ----
  const availableStatuses = getAvailablePostStatuses(rbac.userRole);
  const canPublish = canPublishImmediately(rbac.userRole);
  const needsApproval = needsApprovalToPublish(rbac.userRole);

  // ---- Block Validation ----
  const validation = useBlockValidation({
    blocks: post.content?.blocks ?? [],
    meta: {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      featuredImage: post.featuredImage,
      featuredImageAlt: post.featuredImageAlt,
      status: post.status,
    },
    enabled: true,
    debounceMs: 800,
    minSeverity: 'warning',
  });

  // ---- Notification helper ----
  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // ---- Save function (shared by auto-save & manual save) ----
  const persistDraft = useCallback(async () => {
    const current = postRef.current;

    if (!current.title.trim()) return; // Don't save empty posts

    const endpoint = current.id ? `/api/posts/${current.id}` : '/api/posts';
    const method = current.id ? 'PUT' : 'POST';

    const payload: Record<string, any> = {
      title: current.title,
      content: current.content,
      contentHtml: current.contentHtml,
      excerpt: current.excerpt,
      status: current.status || 'DRAFT',
      featuredImage: current.featuredImage || undefined,
      featuredImageAlt: current.featuredImageAlt || undefined,
      seoTitle: current.seoTitle || undefined,
      metaDescription: current.seoDescription || undefined,
      wordCount: current.wordCount || undefined,
      readingTime: current.readingTime || undefined,
      scheduledAt: current.scheduledAt || undefined,
      categoryIds: current.categories?.map((c: any) => c.id).filter(Boolean),
      tagIds: current.tags?.map((t: any) => t.id).filter(Boolean),
    };

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.errors?.[0] || body.error || 'Save failed');
    }

    const result = await res.json();

    // If this was a create, update the ID so future saves become PUTs
    if (!current.id && result.data?.id) {
      setPost((prev) => ({ ...prev, id: result.data.id, version: result.data.version ?? prev.version }));
      // Update URL without full navigation
      window.history.replaceState(null, '', `/dashboard/posts/editor?id=${result.data.id}`);
    } else if (result.data?.version) {
      setPost((prev) => ({ ...prev, version: result.data.version }));
    }

    return result;
  }, []);

  // ---- Auto-save hook ----
  const autoSave = useAutoSave(persistDraft, {
    delay: 3000,
    enabled: true,
    minInterval: 5000,
    onSuccess: () => {
      // Silently saved — status bar handles feedback
    },
    onError: (err) => {
      console.error('Auto-save error:', err);
    },
  });

  // ---- Post updater that marks dirty ----
  const updatePost = useCallback(
    (updates: Partial<DraftPost>) => {
      setPost((prev) => ({ ...prev, ...updates }));
      autoSave.markDirty();
    },
    [autoSave]
  );

  // ---- Manual save ----
  const handleManualSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await autoSave.saveNow();
      notify('success', 'Draft saved');
    } catch (err: any) {
      notify('error', err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [autoSave, notify]);

  // ---- Publish / submit for review ----
  const handlePublish = useCallback(async () => {
    if (!canPublish && !needsApproval) {
      notify('error', 'You do not have permission to publish posts');
      return;
    }

    // Run publish validation first
    const publishValidation = validation.validateForPublish();
    if (publishValidation.counts.errors > 0) {
      notify('error', `Cannot publish: ${publishValidation.counts.errors} error${publishValidation.counts.errors !== 1 ? 's' : ''} found`);
      setShowPreview(true);
      return;
    }

    const targetStatus = needsApproval ? 'PENDING_REVIEW' : 'PUBLISHED';
    setIsSaving(true);

    try {
      // First ensure the draft is saved so we have an ID
      const current = postRef.current;
      const endpoint = current.id ? `/api/posts/${current.id}` : '/api/posts';
      const method = current.id ? 'PUT' : 'POST';

      const payload: Record<string, any> = {
        title: current.title,
        content: current.content,
        contentHtml: current.contentHtml,
        excerpt: current.excerpt,
        status: targetStatus,
        featuredImage: current.featuredImage || undefined,
        featuredImageAlt: current.featuredImageAlt || undefined,
        seoTitle: current.seoTitle || undefined,
        metaDescription: current.seoDescription || undefined,
        wordCount: current.wordCount || undefined,
        readingTime: current.readingTime || undefined,
        scheduledAt: current.scheduledAt || undefined,
        categoryIds: current.categories?.map((c: any) => c.id).filter(Boolean),
        tagIds: current.tags?.map((t: any) => t.id).filter(Boolean),
      };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.errors?.[0] || 'Publish failed');
      }

      const result = await res.json();
      autoSave.clearDirty();

      if (result.data?.id) {
        setPost((prev) => ({
          ...prev,
          id: result.data.id,
          status: targetStatus,
          version: result.data.version ?? prev.version,
        }));

        trackPublishEvent({
          postId: result.data.id,
          status: targetStatus as 'PUBLISHED' | 'PENDING_REVIEW',
          slug: current.slug || '',
          titleLength: (current.title || '').trim().length,
          wordCount: Number(current.wordCount || 0),
          categoryCount: Array.isArray(current.categories) ? current.categories.length : 0,
          tagCount: Array.isArray(current.tags) ? current.tags.length : 0,
          hasFeaturedImage: Boolean(current.featuredImage),
        });
      }

      notify(
        'success',
        targetStatus === 'PUBLISHED'
          ? 'Post published successfully!'
          : 'Post submitted for review!'
      );
    } catch (err: any) {
      notify('error', err.message || 'Failed to publish');
    } finally {
      setIsSaving(false);
    }
  }, [canPublish, needsApproval, autoSave, notify, validation]);

  // ---- Load existing post when editing ----
  useEffect(() => {
    if (!isEdit || !postId) return;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) throw new Error('Failed to load post');

        const result = await res.json();
        if (cancelled) return;

        if (result.success && result.data) {
          const d = result.data;
          setPost({
            id: d.id,
            title: d.title || '',
            slug: d.slug || '',
            content: d.content,
            contentHtml: d.contentHtml || '',
            excerpt: d.excerpt || '',
            status: d.status || 'DRAFT',
            featuredImage: d.featuredImage || '',
            featuredImageAlt: d.featuredImageAlt || '',
            seoTitle: d.seoTitle || '',
            seoDescription: d.metaDescription || '',
            categories: d.categories || [],
            tags: d.tags || [],
            wordCount: d.wordCount || 0,
            readingTime: d.readingTime || 0,
            scheduledAt: d.scheduledAt || '',
            version: d.version || 1,
          });
        }
      } catch (err) {
        notify('error', 'Failed to load post');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [postId, isEdit, notify]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleManualSave]);

  // ---- Auto-save status UI helpers ----
  const getAutoSaveIcon = () => {
    switch (autoSave.status) {
      case 'saving':
        return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />;
      case 'saved':
        return <CheckCircle className="w-3.5 h-3.5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-red-600" />;
      case 'pending':
        return <Clock className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <CheckCircle className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const getAutoSaveColor = () => {
    switch (autoSave.status) {
      case 'saving': return 'text-blue-600';
      case 'saved': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'pending': return 'text-amber-600';
      default: return 'text-gray-500';
    }
  };

  const formatLastSaved = () => {
    if (!autoSave.lastSavedAt) return null;
    const diff = Math.floor((Date.now() - autoSave.lastSavedAt.getTime()) / 1000);
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return autoSave.lastSavedAt.toLocaleTimeString();
  };

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
          <p className="text-gray-600">Loading post…</p>
        </div>
      </div>
    );
  }

  // ==================================================================
  // RENDER
  // ==================================================================
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* ---- Notification Toast ---- */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {notification.message}
        </div>
      )}

      {/* ---- Header ---- */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard/posts"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            title="Back to posts"
          >
            <X className="w-5 h-5 text-gray-600" />
          </Link>

          <div className="min-w-0">
            <input
              type="text"
              value={post.title}
              onChange={(e) => updatePost({ title: e.target.value })}
              placeholder="Untitled post…"
              className="text-lg font-semibold text-gray-900 bg-transparent border-none outline-none w-full placeholder-gray-400 focus:ring-0"
            />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Auto-save indicator */}
          <div className={`hidden sm:flex items-center gap-1.5 text-xs ${getAutoSaveColor()}`}>
            {getAutoSaveIcon()}
            <span>{autoSave.statusLabel}</span>
            {autoSave.lastSavedAt && autoSave.status !== 'saving' && (
              <span className="text-gray-400 ml-1">· {formatLastSaved()}</span>
            )}
          </div>

          <div className="h-5 w-px bg-gray-200 mx-1 hidden sm:block" />

          {/* Validation badge */}
          {validation.counts.errors > 0 && (
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              title={`${validation.counts.errors} error${validation.counts.errors !== 1 ? 's' : ''} found — click to preview`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{validation.counts.errors}</span>
            </button>
          )}
          {validation.counts.warnings > 0 && validation.counts.errors === 0 && (
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              title={`${validation.counts.warnings} warning${validation.counts.warnings !== 1 ? 's' : ''} found — click to preview`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{validation.counts.warnings}</span>
            </button>
          )}

          {/* Preview */}
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Preview</span>
          </button>

          {/* Sidebar toggle */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-2 rounded-lg transition-colors ${
              showSidebar ? 'bg-gray-100 text-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="Toggle sidebar"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Save draft */}
          <button
            onClick={handleManualSave}
            disabled={isSaving || !autoSave.isDirty}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving…' : 'Save'}</span>
          </button>

          {/* Publish / Submit */}
          {(canPublish || needsApproval) && (
            <button
              onClick={handlePublish}
              disabled={isSaving || !post.title.trim()}
              className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSaving
                ? 'Saving…'
                : needsApproval
                ? 'Submit for Review'
                : 'Publish'}
            </button>
          )}
        </div>
      </header>

      {/* ---- Slug Preview Bar ---- */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/60 shrink-0">
        <SlugPreview
          title={post.title}
          slug={post.slug}
          postId={post.id || undefined}
          onChange={(slug) => updatePost({ slug })}
          compact
        />
      </div>

      {/* ---- Main Content ---- */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor canvas */}
        <div className={`flex-1 overflow-y-auto transition-all ${showSidebar ? 'mr-0' : ''}`}>
          <PostEditor
            postId={post.id || undefined}
            onSave={async () => { await handleManualSave(); }}
            onPublish={async () => { await handlePublish(); }}
            onAutoSave={async () => { autoSave.markDirty(); }}
          />
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <aside className="w-80 shrink-0 border-l border-gray-200 overflow-y-auto bg-white">
            <div className="p-4 space-y-6">
              {/* Status section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Status</h3>
                <div className="relative">
                  <button
                    aria-label="Change post status"
                    onClick={() => setShowStatusMenu(!showStatusMenu)}
                    className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <StatusBadge status={post.status} />
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>

                  {showStatusMenu && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                      {availableStatuses.map((s) => (
                        <button
                          key={s}
                          aria-label={`Set status to ${s.toLowerCase().replace('_', ' ')}`}
                          onClick={() => {
                            updatePost({ status: s });
                            setShowStatusMenu(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                            post.status === s ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                          }`}
                        >
                          <StatusBadge status={s} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Slug — full version */}
              <SlugPreview
                title={post.title}
                slug={post.slug}
                postId={post.id || undefined}
                onChange={(slug) => updatePost({ slug })}
              />

              {/* Excerpt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Excerpt</label>
                <textarea
                  value={post.excerpt}
                  onChange={(e) => updatePost({ excerpt: e.target.value })}
                  placeholder="Brief description…"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">{(post.excerpt || '').length}/300</p>
              </div>

              {/* SEO Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">SEO Title</label>
                <input
                  type="text"
                  value={post.seoTitle}
                  onChange={(e) => updatePost({ seoTitle: e.target.value })}
                  placeholder={post.title || 'Auto-generated from title'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {(post.seoTitle || post.title || '').length}/60
                </p>
              </div>

              {/* Meta Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Meta Description</label>
                <textarea
                  value={post.seoDescription}
                  onChange={(e) => updatePost({ seoDescription: e.target.value })}
                  placeholder={post.excerpt || 'Auto-generated from excerpt'}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {(post.seoDescription || post.excerpt || '').length}/160
                </p>
              </div>

              {/* Featured Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Featured Image</label>
                {post.featuredImage ? (
                  <div className="space-y-2">
                    <img
                      src={post.featuredImage}
                      alt={post.featuredImageAlt || 'Featured image'}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <button
                      onClick={() => updatePost({ featuredImage: '', featuredImageAlt: '' })}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove image
                    </button>
                  </div>
                ) : (
                  <button className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
                    Upload or select image
                  </button>
                )}
              </div>

              {/* Schedule */}
              {availableStatuses.includes('SCHEDULED') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Schedule for
                  </label>
                  <input
                    type="datetime-local"
                    title="Schedule publication date and time"
                    value={post.scheduledAt ? post.scheduledAt.slice(0, 16) : ''}
                    onChange={(e) => updatePost({ scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ---- Status Bar ---- */}
      <footer className="h-8 px-4 flex items-center justify-between border-t border-gray-200 bg-gray-50 text-xs shrink-0">
        {/* Left: save status */}
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 ${getAutoSaveColor()}`}>
            {getAutoSaveIcon()}
            <span className="font-medium">{autoSave.statusLabel}</span>
          </div>

          {autoSave.lastSavedAt && (
            <span className="text-gray-400">
              Last saved: {formatLastSaved()}
            </span>
          )}

          <span className="text-gray-400 flex items-center gap-1">
            {typeof navigator !== 'undefined' && navigator.onLine ? (
              <><Wifi className="w-3 h-3" /> Online</>
            ) : (
              <><WifiOff className="w-3 h-3" /> Offline</>
            )}
          </span>
        </div>

        {/* Center: stats */}
        <div className="flex items-center gap-4 text-gray-500">
          <span>{post.wordCount || 0} words</span>
          <span>~{Math.max(1, Math.ceil((post.wordCount || 0) / 200))} min read</span>
          <span>v{post.version}</span>
        </div>

        {/* Right: status */}
        <div className="flex items-center gap-2">
          <StatusBadge status={post.status} />
        </div>
      </footer>

      {/* ---- Preview Modal ---- */}
      {showPreview && (
        <PostPreview
          post={{
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            content: post.content,
            featuredImage: post.featuredImage,
            featuredImageAlt: post.featuredImageAlt,
            seoTitle: post.seoTitle,
            seoDescription: post.seoDescription,
            categories: post.categories,
            tags: post.tags,
            status: post.status,
            wordCount: post.wordCount,
            readingTime: post.readingTime,
          }}
          validationIssues={validation.visibleIssues}
          validationCounts={validation.counts}
          onClose={() => setShowPreview(false)}
          onBlockClick={(blockId) => {
            // TODO: scroll to block in editor
            setShowPreview(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// STATUS BADGE
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
    PUBLISHED: { label: 'Published', className: 'bg-green-100 text-green-700' },
    SCHEDULED: { label: 'Scheduled', className: 'bg-blue-100 text-blue-700' },
    ARCHIVED: { label: 'Archived', className: 'bg-gray-100 text-gray-500' },
    PENDING_REVIEW: { label: 'Pending Review', className: 'bg-amber-100 text-amber-700' },
  };

  const s = config[status] || config.DRAFT;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

// Protect the editor with minimum CONTRIBUTOR role and CMS access permission
export default withRoleProtection(
  EditorPageComponent,
  UserRole.CONTRIBUTOR,
  ['ACCESS_CMS_EDITOR']
);
