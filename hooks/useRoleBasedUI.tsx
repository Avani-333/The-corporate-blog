'use client';

import { ReactNode } from 'react';
import { UserRole } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { 
  hasPermission, 
  hasMinimumRole, 
  canAccessRoute,
  PERMISSIONS 
} from '@/lib/rbac';

// ============================================================================
// ROLE-BASED UI VISIBILITY HOOKS
// ============================================================================

/**
 * Hook for checking user permissions
 */
export function useRoleBasedUI() {
  const { user } = useAuth();
  const userRole = user?.role;

  return {
    // Permission checks
    hasPermission: (permission: keyof typeof PERMISSIONS) => hasPermission(userRole, permission),
    hasMinimumRole: (minimumRole: UserRole) => hasMinimumRole(userRole, minimumRole),
    canAccessRoute: (route: string) => canAccessRoute(userRole, route),
    
    // Quick role checks
    isAuthenticated: !!user,
    userRole,
    userId: user?.id,
    
    // Admin levels
    isSuperAdmin: userRole === UserRole.SUPER_ADMIN,
    isAdmin: userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN,
    isEditor: hasMinimumRole(userRole, UserRole.EDITOR),
    isAuthor: hasMinimumRole(userRole, UserRole.AUTHOR),
    isContributor: hasMinimumRole(userRole, UserRole.CONTRIBUTOR),
    isModerator: userRole === UserRole.MODERATOR || hasMinimumRole(userRole, UserRole.ADMIN),
    isSubscriber: hasMinimumRole(userRole, UserRole.SUBSCRIBER),
    
    // Content permissions
    canCreatePosts: hasPermission(userRole, 'CREATE_POSTS'),
    canPublishPosts: hasPermission(userRole, 'PUBLISH_POSTS'),
    canManageAllPosts: hasPermission(userRole, 'MANAGE_ALL_POSTS'),
    canModerateComments: hasPermission(userRole, 'MODERATE_ALL_COMMENTS'),
    canManageUsers: hasPermission(userRole, 'MANAGE_ALL_USERS'),
    canViewAnalytics: hasPermission(userRole, 'VIEW_ANALYTICS'),
    
    // Dashboard access
    canAccessAdminDashboard: hasPermission(userRole, 'ACCESS_ADMIN_DASHBOARD'),
    canAccessEditorDashboard: hasPermission(userRole, 'ACCESS_EDITOR_DASHBOARD'),
    canAccessAuthorDashboard: hasPermission(userRole, 'ACCESS_AUTHOR_DASHBOARD'),
  };
}

/**
 * Hook for navigation visibility based on user role
 */
export function useNavigationPermissions() {
  const rbac = useRoleBasedUI();
  
  return {
    // Main navigation items
    showDashboard: rbac.isAuthenticated,
    showAdminPanel: rbac.canAccessAdminDashboard,
    showEditorTools: rbac.canAccessEditorDashboard,
    showAuthorTools: rbac.canAccessAuthorDashboard,
    showModeratorPanel: rbac.isModerator,
    
    // Content management
    showPostManagement: rbac.canCreatePosts,
    showCategoryManagement: rbac.hasPermission('MANAGE_CATEGORIES'),
    showMediaLibrary: rbac.hasPermission('UPLOAD_MEDIA'),
    
    // Analytics and reports
    showAnalytics: rbac.canViewAnalytics,
    showUserManagement: rbac.canManageUsers,
    showSystemSettings: rbac.hasPermission('MANAGE_SETTINGS'),
    
    // Profile and account
    showProfile: rbac.isAuthenticated,
    showAccountSettings: rbac.isAuthenticated,
  };
}

// ============================================================================
// ROLE-BASED UI COMPONENTS
// ============================================================================

interface RoleGateProps {
  children: ReactNode;
  roles?: UserRole[];
  permissions?: (keyof typeof PERMISSIONS)[];
  minimumRole?: UserRole;
  fallback?: ReactNode;
  requireAll?: boolean; // If true, user must have ALL permissions/roles
}

/**
 * Component that conditionally renders children based on user role/permissions
 */
export function RoleGate({ 
  children, 
  roles, 
  permissions, 
  minimumRole,
  fallback = null,
  requireAll = false 
}: RoleGateProps) {
  const rbac = useRoleBasedUI();
  
  // Check if user is authenticated
  if (!rbac.isAuthenticated) {
    return <>{fallback}</>;
  }
  
  let hasAccess = true;
  
  // Check minimum role requirement
  if (minimumRole) {
    hasAccess = rbac.hasMinimumRole(minimumRole);
  }
  
  // Check specific roles
  if (roles && roles.length > 0) {
    const roleCheck = requireAll 
      ? roles.every(role => rbac.userRole === role)
      : roles.some(role => rbac.userRole === role);
    
    hasAccess = hasAccess && roleCheck;
  }
  
  // Check permissions
  if (permissions && permissions.length > 0) {
    const permissionCheck = requireAll
      ? permissions.every(permission => rbac.hasPermission(permission))
      : permissions.some(permission => rbac.hasPermission(permission));
    
    hasAccess = hasAccess && permissionCheck;
  }
  
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

/**
 * Component for admin-only content
 */
export function AdminOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGate 
      minimumRole={UserRole.ADMIN}
      fallback={fallback}
    >
      {children}
    </RoleGate>
  );
}

/**
 * Component for editor-level and above content
 */
export function EditorOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGate 
      minimumRole={UserRole.EDITOR}
      fallback={fallback}
    >
      {children}
    </RoleGate>
  );
}

/**
 * Component for content creators (authors and above)
 */
export function AuthorOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGate 
      minimumRole={UserRole.AUTHOR}
      fallback={fallback}
    >
      {children}
    </RoleGate>
  );
}

/**
 * Component for moderators and admins
 */
export function ModeratorOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGate 
      roles={[UserRole.MODERATOR]}
      minimumRole={UserRole.ADMIN}
      fallback={fallback}
    >
      {children}
    </RoleGate>
  );
}

/**
 * Component that shows different content based on user role
 */
interface RoleSwitchProps {
  superAdmin?: ReactNode;
  admin?: ReactNode;
  editor?: ReactNode;
  author?: ReactNode;
  contributor?: ReactNode;
  moderator?: ReactNode;
  subscriber?: ReactNode;
  user?: ReactNode;
  fallback?: ReactNode;
}

export function RoleSwitch({
  superAdmin,
  admin,
  editor,
  author,
  contributor,
  moderator,
  subscriber,
  user,
  fallback
}: RoleSwitchProps) {
  const { user: currentUser } = useAuth();
  
  if (!currentUser) {
    return <>{fallback}</>;
  }
  
  switch (currentUser.role) {
    case UserRole.SUPER_ADMIN:
      return <>{superAdmin || admin || fallback}</>;
    case UserRole.ADMIN:
      return <>{admin || fallback}</>;
    case UserRole.EDITOR:
      return <>{editor || fallback}</>;
    case UserRole.AUTHOR:
      return <>{author || fallback}</>;
    case UserRole.CONTRIBUTOR:
      return <>{contributor || fallback}</>;
    case UserRole.MODERATOR:
      return <>{moderator || fallback}</>;
    case UserRole.SUBSCRIBER:
      return <>{subscriber || fallback}</>;
    case UserRole.USER:
      return <>{user || fallback}</>;
    default:
      return <>{fallback}</>;
  }
}

// ============================================================================
// PERMISSION-BASED COMPONENTS
// ============================================================================

interface PermissionGateProps {
  children: ReactNode;
  permission: keyof typeof PERMISSIONS;
  fallback?: ReactNode;
}

/**
 * Component that renders children only if user has specific permission
 */
export function PermissionGate({ children, permission, fallback }: PermissionGateProps) {
  const rbac = useRoleBasedUI();
  
  return rbac.hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}

/**
 * Higher-order component for protecting entire pages/routes
 */
export function withRoleProtection<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredRole?: UserRole,
  requiredPermissions?: (keyof typeof PERMISSIONS)[]
) {
  return function ProtectedComponent(props: P) {
    const rbac = useRoleBasedUI();
    
    // Check authentication
    if (!rbac.isAuthenticated) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
            <p className="text-gray-600">Please sign in to access this page.</p>
          </div>
        </div>
      );
    }
    
    // Check role requirement
    if (requiredRole && !rbac.hasMinimumRole(requiredRole)) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }
    
    // Check permission requirements
    if (requiredPermissions) {
      const hasAllPermissions = requiredPermissions.every(permission => 
        rbac.hasPermission(permission)
      );
      
      if (!hasAllPermissions) {
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Insufficient Permissions</h2>
              <p className="text-gray-600">You don't have the required permissions for this page.</p>
            </div>
          </div>
        );
      }
    }
    
    return <WrappedComponent {...props} />;
  };
}