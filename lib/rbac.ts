import { UserRole } from '@/types';

// ============================================================================
// ROLE HIERARCHY & PERMISSIONS
// ============================================================================

/**
 * Role hierarchy levels (higher number = more permissions)
 * Used for role-based access control and UI visibility
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 8,     // Complete system control
  [UserRole.ADMIN]: 7,           // Administrative functions  
  [UserRole.EDITOR]: 6,          // Content editing and publishing
  [UserRole.AUTHOR]: 5,          // Content creation
  [UserRole.CONTRIBUTOR]: 4,     // Limited content creation
  [UserRole.MODERATOR]: 3,       // Comment and user moderation
  [UserRole.SUBSCRIBER]: 2,      // Premium content access
  [UserRole.USER]: 1,            // Basic user access
};

/**
 * Permission definitions for different actions
 * Each permission lists the minimum roles that can perform the action
 */
export const PERMISSIONS = {
  // System Management
  MANAGE_SYSTEM: [UserRole.SUPER_ADMIN],
  MANAGE_SETTINGS: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  VIEW_ANALYTICS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
  
  // User Management
  MANAGE_ALL_USERS: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  MANAGE_ROLES: [UserRole.SUPER_ADMIN],
  MODERATE_USERS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MODERATOR],
  VIEW_USER_LIST: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.MODERATOR],
  
  // Content Management
  MANAGE_ALL_POSTS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
  PUBLISH_POSTS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR],
  CREATE_POSTS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR, UserRole.CONTRIBUTOR],
  EDIT_OWN_POSTS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR, UserRole.CONTRIBUTOR],
  DELETE_ANY_POSTS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
  
  // Categories & Tags
  MANAGE_CATEGORIES: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
  MANAGE_TAGS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR],
  
  // Comments
  MODERATE_ALL_COMMENTS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MODERATOR],
  DELETE_ANY_COMMENTS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MODERATOR],
  MANAGE_OWN_COMMENTS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR, UserRole.CONTRIBUTOR, UserRole.MODERATOR, UserRole.SUBSCRIBER, UserRole.USER],
  
  // Media
  UPLOAD_MEDIA: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR, UserRole.CONTRIBUTOR],
  MANAGE_MEDIA_LIBRARY: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
  
  // Dashboard Access
  ACCESS_ADMIN_DASHBOARD: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  ACCESS_EDITOR_DASHBOARD: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
  ACCESS_AUTHOR_DASHBOARD: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR, UserRole.CONTRIBUTOR],
  ACCESS_USER_PROFILE: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR, UserRole.CONTRIBUTOR, UserRole.MODERATOR, UserRole.SUBSCRIBER, UserRole.USER],
  
  // Advanced Features
  VIEW_SITE_STATISTICS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
  MANAGE_SEO: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
  CONFIGURE_MONETIZATION: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  
  // CMS Editor Permissions
  ACCESS_CMS_EDITOR: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR, UserRole.CONTRIBUTOR],
  PUBLISH_IMMEDIATELY: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR],
  SCHEDULE_POSTS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR],
  MANAGE_POST_WORKFLOW: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
  APPROVE_SUBMISSIONS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
  OVERRIDE_APPROVAL: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  
  // Content Review & Moderation
  REVIEW_DRAFTS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
  EDIT_PUBLISHED_POSTS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
  UNPUBLISH_POSTS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
  ARCHIVE_POSTS: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR],
} as const;

// ============================================================================
// ROLE CHECKING UTILITIES
// ============================================================================

/**
 * Check if a user has a specific permission
 */
export function hasPermission(userRole: UserRole | undefined, permission: keyof typeof PERMISSIONS): boolean {
  if (!userRole) return false;
  return PERMISSIONS[permission].includes(userRole);
}

/**
 * Check if user role meets minimum requirement level
 */
export function hasMinimumRole(userRole: UserRole | undefined, minimumRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Check if user role is higher than another role
 */
export function isHigherRole(userRole: UserRole | undefined, compareRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] > ROLE_HIERARCHY[compareRole];
}

/**
 * Get all roles that have a specific permission
 */
export function getRolesWithPermission(permission: keyof typeof PERMISSIONS): UserRole[] {
  return PERMISSIONS[permission];
}

/**
 * Check if user can manage another user based on roles
 */
export function canManageUser(managerRole: UserRole | undefined, targetRole: UserRole): boolean {
  if (!managerRole) return false;
  
  // Super admin can manage anyone
  if (managerRole === UserRole.SUPER_ADMIN) return true;
  
  // Admin can manage everyone except super admin
  if (managerRole === UserRole.ADMIN && targetRole !== UserRole.SUPER_ADMIN) return true;
  
  // Moderators can manage users and subscribers
  if (managerRole === UserRole.MODERATOR && 
      [UserRole.USER, UserRole.SUBSCRIBER].includes(targetRole)) {
    return true;
  }
  
  return false;
}

/**
 * Get user-friendly role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'Super Administrator',
    [UserRole.ADMIN]: 'Administrator',
    [UserRole.EDITOR]: 'Editor',
    [UserRole.AUTHOR]: 'Author',
    [UserRole.CONTRIBUTOR]: 'Contributor',
    [UserRole.MODERATOR]: 'Moderator',
    [UserRole.SUBSCRIBER]: 'Subscriber',
    [UserRole.USER]: 'User',
  };
  
  return roleNames[role] || 'Unknown';
}

// ============================================================================
// CMS WORKFLOW PERMISSIONS
// ============================================================================

/**
 * Check if user can publish content immediately
 */
export function canPublishImmediately(userRole: UserRole | undefined): boolean {
  return hasPermission(userRole, 'PUBLISH_IMMEDIATELY');
}

/**
 * Check if user needs approval to publish
 */
export function needsApprovalToPublish(userRole: UserRole | undefined): boolean {
  if (!userRole) return true;
  return userRole === UserRole.CONTRIBUTOR;
}

/**
 * Check if user can approve others' content
 */
export function canApproveContent(userRole: UserRole | undefined): boolean {
  return hasPermission(userRole, 'APPROVE_SUBMISSIONS');
}

/**
 * Get available post statuses for user role
 */
export function getAvailablePostStatuses(userRole: UserRole | undefined): string[] {
  if (!userRole) return [];
  
  const baseStatuses = ['DRAFT'];
  
  if (canPublishImmediately(userRole)) {
    baseStatuses.push('PUBLISHED', 'SCHEDULED');
  }
  
  if (needsApprovalToPublish(userRole)) {
    baseStatuses.push('PENDING_REVIEW');
  }
  
  if (hasPermission(userRole, 'ARCHIVE_POSTS')) {
    baseStatuses.push('ARCHIVED');
  }
  
  return baseStatuses;
}

/**
 * Check workflow transition permissions
 */
export function canTransitionPostStatus(
  userRole: UserRole | undefined, 
  fromStatus: string, 
  toStatus: string,
  isOwner: boolean = false
): boolean {
  if (!userRole) return false;
  
  // Super admin and admin can do anything
  if ([UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(userRole)) {
    return true;
  }
  
  // Common transitions for content creators
  if (fromStatus === 'DRAFT') {
    if (toStatus === 'PENDING_REVIEW' && hasPermission(userRole, 'CREATE_POSTS')) {
      return true;
    }
    if (toStatus === 'PUBLISHED' && canPublishImmediately(userRole)) {
      return true;
    }
    if (toStatus === 'SCHEDULED' && hasPermission(userRole, 'SCHEDULE_POSTS')) {
      return true;
    }
  }
  
  // Editor-level permissions
  if (hasPermission(userRole, 'MANAGE_POST_WORKFLOW')) {
    if (fromStatus === 'PENDING_REVIEW' && ['PUBLISHED', 'DRAFT'].includes(toStatus)) {
      return true;
    }
    if (fromStatus === 'PUBLISHED' && ['ARCHIVED', 'DRAFT'].includes(toStatus)) {
      return true;
    }
  }
  
  // Owner permissions for their own content
  if (isOwner && fromStatus === 'PUBLISHED' && toStatus === 'DRAFT') {
    return hasPermission(userRole, 'EDIT_OWN_POSTS');
  }
  
  return false;
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'Complete system control and configuration',
    [UserRole.ADMIN]: 'Administrative functions and user management',
    [UserRole.EDITOR]: 'Content editing, publishing, and management',
    [UserRole.AUTHOR]: 'Content creation and publishing',
    [UserRole.CONTRIBUTOR]: 'Limited content creation (requires approval)',
    [UserRole.MODERATOR]: 'Comment and user moderation',
    [UserRole.SUBSCRIBER]: 'Access to premium content and features',
    [UserRole.USER]: 'Basic access and interaction',
  };
  
  return descriptions[role] || 'Unknown role';
}

/**
 * Get role color for UI components
 */
export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'text-purple-600 bg-purple-50 border-purple-200',
    [UserRole.ADMIN]: 'text-red-600 bg-red-50 border-red-200',
    [UserRole.EDITOR]: 'text-blue-600 bg-blue-50 border-blue-200',
    [UserRole.AUTHOR]: 'text-green-600 bg-green-50 border-green-200',
    [UserRole.CONTRIBUTOR]: 'text-orange-600 bg-orange-50 border-orange-200',
    [UserRole.MODERATOR]: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    [UserRole.SUBSCRIBER]: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    [UserRole.USER]: 'text-gray-600 bg-gray-50 border-gray-200',
  };
  
  return colors[role] || colors[UserRole.USER];
}

// ============================================================================
// DASHBOARD ROUTING
// ============================================================================

/**
 * Get appropriate dashboard route for user role
 */
export function getDashboardRoute(role: UserRole): string {
  const routes: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: '/dashboard/admin',
    [UserRole.ADMIN]: '/dashboard/admin',
    [UserRole.EDITOR]: '/dashboard/editor',
    [UserRole.AUTHOR]: '/dashboard/author',
    [UserRole.CONTRIBUTOR]: '/dashboard/author',
    [UserRole.MODERATOR]: '/dashboard/moderator',
    [UserRole.SUBSCRIBER]: '/dashboard/profile',
    [UserRole.USER]: '/dashboard/profile',
  };
  
  return routes[role] || '/dashboard/profile';
}

/**
 * Check if user can access a specific dashboard route
 */
export function canAccessRoute(userRole: UserRole | undefined, route: string): boolean {
  if (!userRole) return false;
  
  const routePermissions: Record<string, UserRole[]> = {
    '/dashboard/admin': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    '/dashboard/editor': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
    '/dashboard/author': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR, UserRole.CONTRIBUTOR],
    '/dashboard/moderator': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MODERATOR],
    '/dashboard/profile': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR, UserRole.CONTRIBUTOR, UserRole.MODERATOR, UserRole.SUBSCRIBER, UserRole.USER],
    '/dashboard/posts': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR, UserRole.CONTRIBUTOR],
    '/dashboard/analytics': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
    '/dashboard/users': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MODERATOR],
    '/dashboard/settings': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  };
  
  const allowedRoles = routePermissions[route];
  if (!allowedRoles) return true; // Allow access to unprotected routes
  
  return allowedRoles.includes(userRole);
}