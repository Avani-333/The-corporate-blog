/**
 * Authentication Context
 * Provides authentication state management throughout the application
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole, UserStatus, type User } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  username?: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  // Authentication methods
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: (logoutAll?: boolean) => Promise<void>;
  loginWithGoogle: (redirectUrl?: string) => Promise<void>;
  
  // Token management
  refreshToken: () => Promise<boolean>;
  
  // Authorization helpers
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasMinimumRole: (minimumRole: UserRole) => boolean;
  canAccess: (resource: string, action: string) => boolean;
  
  // State management
  clearError: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

// ============================================================================
// ROLE HIERARCHY
// ============================================================================

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 1000,
  [UserRole.ADMIN]: 800,
  [UserRole.MODERATOR]: 600,
  [UserRole.EDITOR]: 400,
  [UserRole.AUTHOR]: 300,
  [UserRole.CONTRIBUTOR]: 200,
  [UserRole.SUBSCRIBER]: 100,
  [UserRole.GUEST]: 50,
};

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.SUPER_ADMIN]: ['*'],
  [UserRole.ADMIN]: ['user:*', 'content:*', 'analytics:view', 'settings:manage'],
  [UserRole.MODERATOR]: ['user:view', 'content:moderate', 'content:edit', 'content:view'],
  [UserRole.EDITOR]: ['content:*'],
  [UserRole.AUTHOR]: ['content:create', 'content:edit:own', 'content:view'],
  [UserRole.CONTRIBUTOR]: ['content:create', 'content:edit:own', 'content:view:own'],
  [UserRole.SUBSCRIBER]: ['content:view:public', 'profile:edit:own'],
  [UserRole.GUEST]: ['content:view:public'],
};

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// AUTH PROVIDER COMPONENT
// ============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  
  // State management
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const setUser = useCallback((user: AuthUser | null) => {
    setState(prev => ({
      ...prev,
      user,
      isAuthenticated: !!user,
      error: null,
    }));
  }, []);

  // ============================================================================
  // ROLE AND PERMISSION HELPERS
  // ============================================================================

  const hasRole = useCallback((role: UserRole): boolean => {
    return state.user?.role === role;
  }, [state.user]);

  const hasAnyRole = useCallback((roles: UserRole[]): boolean => {
    return state.user ? roles.includes(state.user.role) : false;
  }, [state.user]);

  const hasMinimumRole = useCallback((minimumRole: UserRole): boolean => {
    if (!state.user) return false;
    const userLevel = ROLE_HIERARCHY[state.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;
    return userLevel >= requiredLevel;
  }, [state.user]);

  const canAccess = useCallback((resource: string, action: string): boolean => {
    if (!state.user) return false;
    
    const permissions = ROLE_PERMISSIONS[state.user.role] || [];
    const fullPermission = `${resource}:${action}`;
    
    // Check for exact match, wildcard, or super admin
    return permissions.includes('*') ||
           permissions.includes(fullPermission) ||
           permissions.includes(`${resource}:*`);
  }, [state.user]);

  // ============================================================================
  // API CALLS
  // ============================================================================

  const apiCall = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
  }, []);

  // ============================================================================
  // AUTHENTICATION METHODS
  // ============================================================================

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      if (data.success && data.user) {
        setUser(data.user);
        return { success: true };
      } else {
        setError(data.error || 'Login failed');
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [apiCall, setLoading, setError, setUser]);

  const logout = useCallback(async (logoutAll: boolean = false) => {
    try {
      setLoading(true);
      
      await apiCall('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ logoutAll }),
      });
    } catch (error) {
      // Even if logout fails, clear local state
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setLoading(false);
      router.push('/');
    }
  }, [apiCall, setLoading, setUser, router]);

  const loginWithGoogle = useCallback(async (redirectUrl?: string) => {
    try {
      const params = new URLSearchParams();
      if (redirectUrl) params.set('redirect', redirectUrl);

      const data = await apiCall(`/api/auth/google?${params.toString()}`);
      
      if (data.success && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError(data.error || 'Failed to initiate Google login');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google login failed';
      setError(errorMessage);
    }
  }, [apiCall, setError]);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const data = await apiCall('/api/auth/refresh', {
        method: 'POST',
      });

      if (data.success && data.user) {
        setUser(data.user);
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      setUser(null);
      return false;
    }
  }, [apiCall, setUser]);

  // ============================================================================
  // USER PROFILE METHODS
  // ============================================================================

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setState(prev => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...updates } : null,
    }));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Try to refresh token to restore session
        const refreshed = await refreshToken();
        
        if (!refreshed && mounted) {
          // No valid session found
          setUser(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [refreshToken, setUser, setLoading]);

  // ============================================================================
  // AUTO REFRESH TOKEN
  // ============================================================================

  useEffect(() => {
    if (!state.isAuthenticated) return;

    // Set up automatic token refresh (every 10 minutes)
    const interval = setInterval(() => {
      refreshToken().catch(console.error);
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [state.isAuthenticated, refreshToken]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    loginWithGoogle,
    refreshToken,
    hasRole,
    hasAnyRole,
    hasMinimumRole,
    canAccess,
    clearError,
    updateUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default AuthContext;
