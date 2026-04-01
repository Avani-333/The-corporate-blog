'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

// ============================================================================
// BREADCRUMB CONFIGURATION
// ============================================================================

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const routeLabels: Record<string, string> = {
  'dashboard': 'Dashboard',
  'posts': 'Posts',
  'new': 'Create New',
  'edit': 'Edit',
  'drafts': 'Drafts',
  'scheduled': 'Scheduled',
  'categories': 'Categories',
  'tags': 'Tags',
  'media': 'Media Library',
  'comments': 'Comments',
  'users': 'Users',
  'analytics': 'Analytics',
  'content': 'Content Performance',
  'engagement': 'User Engagement',
  'admin': 'Administration',
  'general': 'General Settings',
  'security': 'Security',
  'integrations': 'Integrations',
  'profile': 'Profile',
  'settings': 'Settings',
  'moderator': 'Moderation',
};

// ============================================================================
// BREADCRUMB COMPONENT
// ============================================================================

export default function DashboardBreadcrumbs() {
  const pathname = usePathname();

  // Generate breadcrumb items from pathname
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    // Always start with home
    breadcrumbs.push({
      label: 'Home',
      href: '/',
    });

    // Build breadcrumbs from path segments
    let currentPath = '';
    
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Skip dynamic route parameters (like post IDs)
      if (isDynamicSegment(segment)) {
        breadcrumbs.push({
          label: getDynamicSegmentLabel(segment, segments[index - 1]),
        });
        return;
      }

      const label = routeLabels[segment] || formatSegmentLabel(segment);
      
      // Don't link to the current page
      const isLast = index === segments.length - 1;
      
      breadcrumbs.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    });

    return breadcrumbs;
  };

  // Check if a segment is a dynamic route parameter
  const isDynamicSegment = (segment: string): boolean => {
    // Check for UUIDs, numbers, or other dynamic patterns
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const numberPattern = /^\d+$/;
    
    return uuidPattern.test(segment) || numberPattern.test(segment);
  };

  // Get label for dynamic segments
  const getDynamicSegmentLabel = (segment: string, parentSegment?: string): string => {
    if (parentSegment === 'posts') {
      return 'Post Details';
    }
    if (parentSegment === 'users') {
      return 'User Profile';
    }
    if (parentSegment === 'categories') {
      return 'Category Details';
    }
    if (parentSegment === 'tags') {
      return 'Tag Details';
    }
    
    return 'Details';
  };

  // Format segment labels
  const formatSegmentLabel = (segment: string): string => {
    return segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length <= 2) {
    return null; // Don't show breadcrumbs for simple paths
  }

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-4">
        {breadcrumbs.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="flex-shrink-0 h-4 w-4 text-gray-400 mr-4" />
            )}
            
            {item.href ? (
              <Link
                href={item.href}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center"
              >
                {index === 0 && <Home className="w-4 h-4 mr-1" />}
                {item.label}
              </Link>
            ) : (
              <span className="text-sm font-medium text-gray-900 flex items-center">
                {index === 0 && <Home className="w-4 h-4 mr-1" />}
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}