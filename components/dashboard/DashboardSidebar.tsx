'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home,
  FileText,
  Users,
  BarChart3,
  Settings,
  Tag,
  FolderOpen,
  MessageSquare,
  Image,
  Shield,
  TrendingUp,
  Calendar,
  X,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleBasedUI, RoleGate } from '@/hooks/useRoleBasedUI';
import { UserRole } from '@/types';

// ============================================================================
// NAVIGATION ITEM TYPES
// ============================================================================

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  permission?: string;
  minimumRole?: UserRole;
  roles?: UserRole[];
  children?: NavItem[];
}

// ============================================================================
// NAVIGATION CONFIGURATION
// ============================================================================

const navigationItems: NavItem[] = [
  // Overview
  {
    label: 'Overview',
    href: '/dashboard',
    icon: Home,
  },
  
  // Content Management
  {
    label: 'Posts',
    href: '/dashboard/posts',
    icon: FileText,
    minimumRole: UserRole.CONTRIBUTOR,
    children: [
      { 
        label: 'All Posts', 
        href: '/dashboard/posts',
        icon: FileText,
        minimumRole: UserRole.CONTRIBUTOR,
      },
      { 
        label: 'Create New', 
        href: '/dashboard/posts/new',
        icon: FileText,
        minimumRole: UserRole.CONTRIBUTOR,
      },
      { 
        label: 'Drafts', 
        href: '/dashboard/posts/drafts',
        icon: FileText,
        minimumRole: UserRole.CONTRIBUTOR,
      },
      { 
        label: 'Scheduled', 
        href: '/dashboard/posts/scheduled',
        icon: Calendar,
        minimumRole: UserRole.AUTHOR,
      },
    ],
  },
  
  // Categories & Tags
  {
    label: 'Categories',
    href: '/dashboard/categories',
    icon: FolderOpen,
    minimumRole: UserRole.EDITOR,
  },
  {
    label: 'Tags',
    href: '/dashboard/tags',
    icon: Tag,
    minimumRole: UserRole.AUTHOR,
  },
  
  // Media
  {
    label: 'Media Library',
    href: '/dashboard/media',
    icon: Image,
    minimumRole: UserRole.CONTRIBUTOR,
  },
  
  // Comments
  {
    label: 'Comments',
    href: '/dashboard/comments',
    icon: MessageSquare,
    minimumRole: UserRole.MODERATOR,
    badge: '12', // Mock unmoderated count
  },
  
  // Users & Moderation
  {
    label: 'Users',
    href: '/dashboard/users',
    icon: Users,
    minimumRole: UserRole.MODERATOR,
  },
  
  // Analytics & Reports
  {
    label: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
    minimumRole: UserRole.EDITOR,
    children: [
      {
        label: 'Overview',
        href: '/dashboard/analytics',
        icon: TrendingUp,
        minimumRole: UserRole.EDITOR,
      },
      {
        label: 'Content Performance',
        href: '/dashboard/analytics/content',
        icon: FileText,
        minimumRole: UserRole.EDITOR,
      },
      {
        label: 'User Engagement',
        href: '/dashboard/analytics/engagement',
        icon: Users,
        minimumRole: UserRole.EDITOR,
      },
    ],
  },
  
  // Administration
  {
    label: 'System Settings',
    href: '/dashboard/admin',
    icon: Settings,
    minimumRole: UserRole.ADMIN,
    children: [
      {
        label: 'General',
        href: '/dashboard/admin/general',
        icon: Settings,
        minimumRole: UserRole.ADMIN,
      },
      {
        label: 'Security',
        href: '/dashboard/admin/security',
        icon: Shield,
        minimumRole: UserRole.SUPER_ADMIN,
      },
      {
        label: 'Integrations',
        href: '/dashboard/admin/integrations',
        icon: Settings,
        minimumRole: UserRole.ADMIN,
      },
    ],
  },
];

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const rbac = useRoleBasedUI();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (href: string) => {
    setExpandedItems(prev => 
      prev.includes(href) 
        ? prev.filter(item => item !== href)
        : [...prev, href]
    );
  };

  const isItemActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const hasAccessToItem = (item: NavItem) => {
    // Check minimum role
    if (item.minimumRole && !rbac.hasMinimumRole(item.minimumRole)) {
      return false;
    }
    
    // Check specific roles
    if (item.roles && !item.roles.includes(rbac.userRole!)) {
      return false;
    }
    
    // Check permissions (if implemented)
    if (item.permission && !rbac.hasPermission(item.permission as any)) {
      return false;
    }
    
    return true;
  };

  const renderNavItem = (item: NavItem, depth = 0) => {
    if (!hasAccessToItem(item)) {
      return null;
    }

    const isActive = isItemActive(item.href);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.href);
    const Icon = item.icon;

    const itemClasses = `
      flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors
      ${depth > 0 ? 'ml-6 pl-4' : ''}
      ${isActive 
        ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-700' 
        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
      }
    `;

    return (
      <div key={item.href}>
        {hasChildren ? (
          <button
            onClick={() => toggleExpanded(item.href)}
            className={itemClasses}
          >
            <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <span className="bg-red-100 text-red-600 px-2 py-1 text-xs rounded-full mr-2">
                {item.badge}
              </span>
            )}
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <Link href={item.href} className={itemClasses} onClick={onClose}>
            <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="bg-red-100 text-red-600 px-2 py-1 text-xs rounded-full">
                {item.badge}
              </span>
            )}
          </Link>
        )}
        
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children?.map(child => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:fixed lg:inset-y-0 lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          {/* Logo/Brand */}
          <div className="flex items-center flex-shrink-0 px-6 py-4 border-b border-gray-200">
            <Link href="/" className="flex items-center">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <span className="ml-3 text-lg font-semibold text-gray-900">
                The Corporate Blog
              </span>
            </Link>
          </div>

          {/* User info */}
          <div className="flex items-center px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-700 font-medium text-sm">
                  {user?.name.charAt(0) || 'U'}
                </span>
              </div>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {user?.role.replace('_', ' ').toLowerCase()}
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigationItems.map(item => renderNavItem(item))}
          </nav>

          {/* Quick stats */}
          <div className="flex-shrink-0 p-4 border-t border-gray-200">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Quick Stats
              </div>
              <div className="space-y-2">
                {rbac.canCreatePosts && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">My Posts</span>
                    <span className="font-medium">12</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Views Today</span>
                  <span className="font-medium">1,234</span>
                </div>
                {rbac.canModerateComments && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pending</span>
                    <span className="font-medium text-orange-600">3</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className={`lg:hidden ${isOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-shrink-0 w-64 bg-white border-r border-gray-200">
            <div className="flex flex-col h-full">
              {/* Header with close button */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <Link href="/" className="flex items-center">
                  <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">T</span>
                  </div>
                  <span className="ml-3 text-lg font-semibold text-gray-900">
                    TCB
                  </span>
                </Link>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User info */}
              <div className="flex items-center px-4 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-medium text-sm">
                      {user?.name.charAt(0) || 'U'}
                    </span>
                  </div>
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    {user?.role.replace('_', ' ').toLowerCase()}
                  </p>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navigationItems.map(item => renderNavItem(item))}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}