'use client';

import { useMemo, useState } from 'react';
import { Search, Plus, Filter, Eye, Edit, Calendar, BookOpen } from 'lucide-react';
import { withRoleProtection } from '@/hooks/useRoleBasedUI';
import { UserRole } from '@/types';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: Date;
  author: string;
  category: string;
  views: number;
}

const mockPosts: BlogPost[] = [
  {
    id: '1',
    title: 'Getting Started with Next.js 14',
    slug: 'getting-started-nextjs-14',
    status: 'published',
    createdAt: new Date('2024-01-15'),
    author: 'John Doe',
    category: 'Technology',
    views: 1250,
  },
  {
    id: '2',
    title: 'Building Scalable React Applications',
    slug: 'building-scalable-react-applications',
    status: 'draft',
    createdAt: new Date('2024-01-10'),
    author: 'Jane Smith',
    category: 'Development',
    views: 0,
  },
  {
    id: '3',
    title: 'Advanced TypeScript Patterns',
    slug: 'advanced-typescript-patterns',
    status: 'published',
    createdAt: new Date('2024-01-05'),
    author: 'Mike Johnson',
    category: 'Programming',
    views: 890,
  },
];

function statusClass(status: BlogPost['status']): string {
  if (status === 'published') return 'bg-green-100 text-green-800';
  if (status === 'draft') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-800';
}

function PostsDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BlogPost['status']>('all');

  const filteredPosts = useMemo(() => {
    return mockPosts.filter((post) => {
      const matchesSearch =
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Posts</h1>
        <p className="mt-2 text-gray-600">Manage your drafts and published posts.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-lg">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search posts..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | BlogPost['status'])}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <button className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700">
              <Plus className="h-4 w-4 mr-1" />
              New Post
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Post</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Views</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPosts.map((post) => (
              <tr key={post.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-4 w-4 text-primary-600" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{post.title}</div>
                      <div className="text-xs text-gray-500">/{post.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusClass(post.status)}`}>
                    {post.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{post.author}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  <div className="inline-flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    {post.createdAt.toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{post.views.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <div className="inline-flex items-center gap-2">
                    <button className="inline-flex items-center px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50">
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </button>
                    <button className="inline-flex items-center px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50">
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredPosts.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-600">No posts match your current filters.</div>
        )}
      </div>
    </div>
  );
}

export default withRoleProtection(PostsDashboard, UserRole.CONTRIBUTOR);
