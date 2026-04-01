'use client';

import { useState } from 'react';
import { 
  Settings, 
  Eye, 
  Tag, 
  Calendar, 
  User, 
  Image, 
  Globe, 
  Clock,
  FileText,
  Hash,
  AlertCircle,
  CheckCircle,
  XCircle,
  Badge
} from 'lucide-react';
import { PostStatus, UserRole } from '@/types';
import { canTransitionPostStatus } from '@/lib/rbac';
import { SponsorshipPanel } from './SponsorshipPanel';

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: PostStatus;
  featuredImage: string;
  seoTitle: string;
  seoDescription: string;
  categories: any[];
  tags: any[];
  is_sponsored?: boolean;
  affiliateLinkVia?: string | null;
  enforceDisclosureBanner?: boolean;
  highlightAffiliateLinks?: boolean;
}

interface EditorSidebarProps {
  post: Post;
  onChange: (post: Post) => void;
  availableStatuses: string[];
  canPublish: boolean;
  needsApproval: boolean;
}

const CATEGORIES = [
  { id: '1', name: 'Technology', slug: 'technology' },
  { id: '2', name: 'Business', slug: 'business' },
  { id: '3', name: 'Design', slug: 'design' },
  { id: '4', name: 'Marketing', slug: 'marketing' },
  { id: '5', name: 'Lifestyle', slug: 'lifestyle' }
];

const TAGS = [
  'javascript', 'typescript', 'react', 'nextjs', 'nodejs', 
  'design', 'ux', 'ui', 'marketing', 'seo', 'business',
  'startup', 'productivity', 'tutorial', 'guide'
];

const STATUS_LABELS = {
  [PostStatus.DRAFT]: { label: 'Draft', color: 'text-gray-600', icon: FileText },
  [PostStatus.PUBLISHED]: { label: 'Published', color: 'text-green-600', icon: CheckCircle },
  [PostStatus.SCHEDULED]: { label: 'Scheduled', color: 'text-blue-600', icon: Clock },
  [PostStatus.ARCHIVED]: { label: 'Archived', color: 'text-gray-500', icon: XCircle },
  'PENDING_REVIEW': { label: 'Pending Review', color: 'text-yellow-600', icon: AlertCircle },
};

export function EditorSidebar({ 
  post, 
  onChange, 
  availableStatuses, 
  canPublish, 
  needsApproval 
}: EditorSidebarProps) {
  const [activeTab, setActiveTab] = useState<'post' | 'sponsorship' | 'publish'>('post');
  const [tagInput, setTagInput] = useState('');

  const handleUpdate = (field: string, value: any) => {
    onChange({ ...post, [field]: value });
  };

  const addTag = (tag: string) => {
    if (!tag.trim() || post.tags.some(t => t.name === tag.trim())) return;
    
    const newTags = [...post.tags, { name: tag.trim(), slug: tag.trim().toLowerCase() }];
    handleUpdate('tags', newTags);
    setTagInput('');
  };

  const removeTag = (tagName: string) => {
    const newTags = post.tags.filter(t => t.name !== tagName);
    handleUpdate('tags', newTags);
  };

  const getStatusInfo = (status: string) => {
    return STATUS_LABELS[status as keyof typeof STATUS_LABELS] || STATUS_LABELS[PostStatus.DRAFT];
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('post')}
            className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'post' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('sponsorship')}
            className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'sponsorship' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Badge className="w-4 h-4" />
            <span className="hidden sm:inline">Sponsor</span>
          </button>
          <button
            onClick={() => setActiveTab('publish')}
            className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'publish' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Publish</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'post' && (
          <div className="p-4 space-y-6">
            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="w-4 h-4 inline mr-1" />
                Categories
              </label>
              <div className="space-y-2">
                {CATEGORIES.map((category) => (
                  <label key={category.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={post.categories.some(c => c.id === category.id)}
                      onChange={(e) => {
                        const newCategories = e.target.checked
                          ? [...post.categories, category]
                          : post.categories.filter(c => c.id !== category.id);
                        handleUpdate('categories', newCategories);
                      }}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{category.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Hash className="w-4 h-4 inline mr-1" />
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag.name}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary-100 text-primary-800"
                  >
                    {tag.name}
                    <button
                      onClick={() => removeTag(tag.name)}
                      className="ml-1 w-3 h-3 flex items-center justify-center hover:bg-primary-200 rounded-full"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag(tagInput))}
                  placeholder="Add a tag..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  onClick={() => addTag(tagInput)}
                  className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => addTag(tag)}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Featured Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Image className="w-4 h-4 inline mr-1" />
                Featured Image
              </label>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                {post.featuredImage ? (
                  <img 
                    src={post.featuredImage} 
                    alt="Featured" 
                    className="w-full h-32 object-cover rounded-lg mb-2"
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                    <Image className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <button className="text-sm text-primary-600 hover:text-primary-700">
                  {post.featuredImage ? 'Change image' : 'Upload image'}
                </button>
              </div>
            </div>

            {/* Excerpt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Excerpt
              </label>
              <textarea
                value={post.excerpt}
                onChange={(e) => handleUpdate('excerpt', e.target.value)}
                placeholder="Brief description of your post..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {activeTab === 'sponsorship' && (
          <div className="p-4">
            <SponsorshipPanel
              isSponsored={post.is_sponsored || false}
              affiliateLinkVia={post.affiliateLinkVia || null}
              enforceDisclosureBanner={post.enforceDisclosureBanner || false}
              highlightAffiliateLinks={post.highlightAffiliateLinks || false}
              onToggleSponsored={(value) => handleUpdate('is_sponsored', value)}
              onAffiliateLinkChange={(value) => handleUpdate('affiliateLinkVia', value)}
              onToggleDisclosureBanner={(value) => handleUpdate('enforceDisclosureBanner', value)}
              onToggleHighlightLinks={(value) => handleUpdate('highlightAffiliateLinks', value)}
              postSlug={post.slug}
            />
          </div>
        )}

        {activeTab === 'publish' && (
          <div className="p-4 space-y-6">
            {/* Post Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="space-y-3">
                {/* Current Status Display */}
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const StatusIcon = getStatusInfo(post.status).icon;
                      return <StatusIcon className={`w-4 h-4 ${getStatusInfo(post.status).color}`} />;
                    })()}
                    <span className={`text-sm font-medium ${getStatusInfo(post.status).color}`}>
                      {getStatusInfo(post.status).label}
                    </span>
                  </div>
                </div>

                {/* Publishing Controls */}
                <div className="space-y-2">
                  {availableStatuses.includes('DRAFT') && (
                    <button
                      onClick={() => handleUpdate('status', PostStatus.DRAFT)}
                      className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg border transition-colors"
                    >
                      Save as Draft
                    </button>
                  )}
                  
                  {availableStatuses.includes('PENDING_REVIEW') && needsApproval && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800">
                            Requires Approval
                          </p>
                          <p className="text-sm text-yellow-700 mt-1">
                            Your posts need to be reviewed before publishing.
                          </p>
                          <button
                            onClick={() => handleUpdate('status', 'PENDING_REVIEW')}
                            className="mt-2 px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                          >
                            Submit for Review
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {availableStatuses.includes('PUBLISHED') && canPublish && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-green-800">
                            Ready to Publish
                          </p>
                          <p className="text-sm text-green-700 mt-1">
                            Your post will be immediately visible to readers.
                          </p>
                          <button
                            onClick={() => handleUpdate('status', PostStatus.PUBLISHED)}
                            className="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          >
                            Publish Now
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {availableStatuses.includes('SCHEDULED') && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <Clock className="w-4 h-4 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-800">
                            Schedule Publishing
                          </p>
                          <p className="text-sm text-blue-700 mt-1">
                            Set a future date and time for your post.
                          </p>
                          <button className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                            Schedule Post
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Permission Info */}
                {!canPublish && !needsApproval && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <XCircle className="w-4 h-4 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Limited Publishing Access
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Contact an administrator to upgrade your publishing permissions.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SEO Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Globe className="w-4 h-4 inline mr-1" />
                SEO
              </label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    SEO Title
                  </label>
                  <input
                    type="text"
                    value={post.seoTitle}
                    onChange={(e) => handleUpdate('seoTitle', e.target.value)}
                    placeholder={post.title || "Enter SEO title..."}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    SEO Description
                  </label>
                  <textarea
                    value={post.seoDescription}
                    onChange={(e) => handleUpdate('seoDescription', e.target.value)}
                    placeholder={post.excerpt || "Enter SEO description..."}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* URL Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL Slug
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 py-2 border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-l-lg">
                  /blog/
                </span>
                <input
                  type="text"
                  value={post.slug}
                  onChange={(e) => handleUpdate('slug', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 text-sm rounded-r-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
