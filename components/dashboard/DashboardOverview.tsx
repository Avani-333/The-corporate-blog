'use client';

import { 
  FileText, 
  Users, 
  MessageSquare, 
  BarChart3,
  TrendingUp,
  Eye,
  Heart,
  Calendar,
  Clock,
  Target,
  Award,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleBasedUI, RoleGate } from '@/hooks/useRoleBasedUI';
import { getRoleDisplayName } from '@/lib/rbac';
import { UserRole } from '@/types';

// ============================================================================
// DASHBOARD WIDGETS
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}

function StatCard({ title, value, change, changeType = 'neutral', icon: Icon, href }: StatCardProps) {
  const changeColors = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-gray-600',
  };

  const content = (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Icon className="h-8 w-8 text-primary-600" />
        </div>
        <div className="ml-4 flex-1">
          <div className="text-sm font-medium text-gray-600">{title}</div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          {change && (
            <div className={`text-sm ${changeColors[changeType]}`}>
              {change}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return href ? (
    <a href={href} className="block">
      {content}
    </a>
  ) : content;
}

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color?: string;
}

function QuickAction({ title, description, icon: Icon, href, color = 'primary' }: QuickActionProps) {
  return (
    <a
      href={href}
      className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-center">
        <div className={`flex-shrink-0 p-3 bg-${color}-100 rounded-lg group-hover:bg-${color}-200 transition-colors`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-medium text-gray-900 group-hover:text-primary-700">
            {title}
          </h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </a>
  );
}

// ============================================================================
// RECENT ACTIVITY FEED
// ============================================================================

interface ActivityItem {
  id: string;
  type: 'post' | 'comment' | 'user' | 'system';
  title: string;
  description: string;
  timestamp: string;
  href?: string;
}

function RecentActivity() {
  // Mock activity data - would come from API
  const activities: ActivityItem[] = [
    {
      id: '1',
      type: 'post',
      title: 'New post published',
      description: '"Advanced React Patterns" by Mike Author',
      timestamp: '2 hours ago',
      href: '/dashboard/posts/123',
    },
    {
      id: '2',
      type: 'comment',
      title: 'Comment awaiting moderation',
      description: 'On "Understanding TypeScript Generics"',
      timestamp: '4 hours ago',
      href: '/dashboard/comments',
    },
    {
      id: '3',
      type: 'user',
      title: 'New user registered',
      description: 'jane.doe@example.com joined as Subscriber',
      timestamp: '6 hours ago',
      href: '/dashboard/users',
    },
    {
      id: '4',
      type: 'post',
      title: 'Draft saved',
      description: '"Modern CSS Techniques" by Sarah Editor',
      timestamp: '8 hours ago',
      href: '/dashboard/posts/drafts',
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'post': return FileText;
      case 'comment': return MessageSquare;
      case 'user': return Users;
      default: return BarChart3;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {activities.map(activity => {
          const Icon = getActivityIcon(activity.type);
          return (
            <div key={activity.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon className="h-5 w-5 text-gray-400" />
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.title}
                  </p>
                  <p className="text-sm text-gray-600 truncate">
                    {activity.description}
                  </p>
                </div>
                <div className="flex-shrink-0 text-sm text-gray-500">
                  {activity.timestamp}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-6 py-3 bg-gray-50 text-center">
        <a href="#" className="text-sm font-medium text-primary-600 hover:text-primary-700">
          View all activity
        </a>
      </div>
    </div>
  );
}

// ============================================================================
// CONTENT OVERVIEW
// ============================================================================

function ContentOverview() {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Content Overview</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">24</div>
            <div className="text-sm text-gray-600">Published Posts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">8</div>
            <div className="text-sm text-gray-600">Draft Posts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">3</div>
            <div className="text-sm text-gray-600">Scheduled</div>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">This week's goal</span>
            <span className="font-medium text-gray-900">3 of 5 posts</span>
          </div>
          <div className="mt-2 bg-gray-200 rounded-full h-2">
            <div className="bg-primary-600 h-2 rounded-full" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD OVERVIEW
// ============================================================================

export default function DashboardOverview() {
  const { user } = useAuth();
  const rbac = useRoleBasedUI();

  // Get role-specific greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const roleTitle = user ? getRoleDisplayName(user.role) : '';
    
    return `${timeGreeting}, ${user?.name || 'User'}`;
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{getGreeting()}</h1>
        <p className="text-gray-600 mt-1">
          Welcome to your dashboard. Here's what's happening with your content.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <RoleGate minimumRole={UserRole.CONTRIBUTOR}>
          <StatCard
            title="My Posts"
            value="12"
            change="+2 this week"
            changeType="positive"
            icon={FileText}
            href="/dashboard/posts"
          />
        </RoleGate>

        <StatCard
          title="Total Views"
          value="45.2K"
          change="+12% from last month"
          changeType="positive"
          icon={Eye}
        />

        <RoleGate minimumRole={UserRole.MODERATOR}>
          <StatCard
            title="Comments"
            value="234"
            change="3 pending"
            changeType="neutral"
            icon={MessageSquare}
            href="/dashboard/comments"
          />
        </RoleGate>

        <RoleGate minimumRole={UserRole.EDITOR}>
          <StatCard
            title="Total Users"
            value="1.2K"
            change="+45 this month"
            changeType="positive"
            icon={Users}
            href="/dashboard/users"
          />
        </RoleGate>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <RoleGate minimumRole={UserRole.CONTRIBUTOR}>
            <QuickAction
              title="Create New Post"
              description="Start writing your next blog post"
              icon={FileText}
              href="/dashboard/posts/new"
            />
          </RoleGate>

          <RoleGate minimumRole={UserRole.AUTHOR}>
            <QuickAction
              title="Manage Tags"
              description="Organize your content with tags"
              icon={Target}
              href="/dashboard/tags"
              color="green"
            />
          </RoleGate>

          <RoleGate minimumRole={UserRole.EDITOR}>
            <QuickAction
              title="View Analytics"
              description="Check your content performance"
              icon={BarChart3}
              href="/dashboard/analytics"
              color="blue"
            />
          </RoleGate>

          <RoleGate minimumRole={UserRole.CONTRIBUTOR}>
            <QuickAction
              title="Media Library"
              description="Upload and manage images"
              icon={Eye}
              href="/dashboard/media"
              color="purple"
            />
          </RoleGate>

          <RoleGate minimumRole={UserRole.MODERATOR}>
            <QuickAction
              title="Moderate Comments"
              description="Review pending comments"
              icon={MessageSquare}
              href="/dashboard/comments"
              color="orange"
            />
          </RoleGate>

          <RoleGate minimumRole={UserRole.ADMIN}>
            <QuickAction
              title="System Settings"
              description="Configure platform settings"
              icon={Award}
              href="/dashboard/admin"
              color="red"
            />
          </RoleGate>
        </div>
      </div>

      {/* Content Overview & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <RoleGate minimumRole={UserRole.CONTRIBUTOR}>
          <ContentOverview />
        </RoleGate>
        
        <RecentActivity />
      </div>
    </div>
  );
}