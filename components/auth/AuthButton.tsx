/**
 * Authentication Button Component
 * Smart button that shows login/logout based on auth state
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User, Settings, Shield, Loader2, ChevronDown } from 'lucide-react';
import { UserRole } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

interface AuthButtonProps {
  /** Custom class names */
  className?: string;
  /** Show user menu dropdown */
  showDropdown?: boolean;
  /** Redirect URL after login */
  loginRedirect?: string;
  /** Custom login button text */
  loginText?: string;
  /** Show user avatar */
  showAvatar?: boolean;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
}

interface UserMenuProps {
  onClose: () => void;
}

// ============================================================================
// USER MENU COMPONENT
// ============================================================================

function UserMenu({ onClose }: UserMenuProps) {
  const router = useRouter();
  const { user, logout, hasMinimumRole } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleNavigation = (path: string) => {
    router.push(path);
    onClose();
  };

  const handleLogout = async (logoutAll = false) => {
    setIsLoggingOut(true);
    try {
      await logout(logoutAll);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
      onClose();
    }
  };

  if (!user) return null;

  const menuItems = [
    {
      icon: User,
      label: 'Profile',
      onClick: () => handleNavigation('/profile'),
      show: true,
    },
    {
      icon: Settings,
      label: 'Settings',
      onClick: () => handleNavigation('/settings'),
      show: true,
    },
    {
      icon: Shield,
      label: 'Dashboard',
      onClick: () => handleNavigation('/dashboard'),
      show: hasMinimumRole(UserRole.SUBSCRIBER),
    },
  ];

  return (
    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
      {/* User Info */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-medium text-gray-900 truncate">
          {user.name || user.username || 'User'}
        </p>
        <p className="text-sm text-gray-500 truncate">{user.email}</p>
        <p className="text-xs text-gray-400 mt-1 capitalize">
          {user.role.replace('_', ' ').toLowerCase()}
        </p>
      </div>

      {/* Menu Items */}
      <div className="py-1">
        {menuItems
          .filter(item => item.show)
          .map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <Icon className="h-4 w-4 mr-3" />
                {item.label}
              </button>
            );
          })}
      </div>

      {/* Logout Section */}
      <div className="py-1 border-t border-gray-100">
        <button
          onClick={() => handleLogout(false)}
          disabled={isLoggingOut}
          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50"
        >
          {isLoggingOut ? (
            <Loader2 className="h-4 w-4 mr-3 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4 mr-3" />
          )}
          Sign out
        </button>
        <button
          onClick={() => handleLogout(true)}
          disabled={isLoggingOut}
          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-800 transition-colors disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 mr-3" />
          Sign out all devices
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AuthButton({
  className = '',
  showDropdown = true,
  loginRedirect = '/dashboard',
  loginText = 'Sign in',
  showAvatar = true,
  variant = 'primary',
  size = 'md',
}: AuthButtonProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  // ============================================================================
  // STYLES
  // ============================================================================

  const baseStyles = 'inline-flex items-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200';
  
  const variantStyles = {
    primary: 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'text-blue-600 bg-blue-50 hover:bg-blue-100 focus:ring-blue-500',
    ghost: 'text-gray-700 bg-transparent hover:bg-gray-100 focus:ring-gray-500',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const buttonStyles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleLogin = () => {
    const loginUrl = new URL('/auth/login', window.location.origin);
    loginUrl.searchParams.set('redirect', loginRedirect);
    router.push(loginUrl.toString());
  };

  const handleUserClick = () => {
    if (showDropdown) {
      setShowMenu(!showMenu);
    } else {
      router.push('/profile');
    }
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (isLoading) {
    return (
      <div className={`${buttonStyles} opacity-50 cursor-not-allowed`}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  // ============================================================================
  // AUTHENTICATED STATE
  // ============================================================================

  if (isAuthenticated && user) {
    return (
      <div className="relative">
        <button
          onClick={handleUserClick}
          className={`${buttonStyles} ${showDropdown ? 'pr-8' : ''}`}
        >
          {/* Avatar */}
          {showAvatar && (
            <div className="mr-2">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || user.username || 'User'}
                  className={`rounded-full ${
                    size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'
                  }`}
                />
              ) : (
                <div
                  className={`bg-gray-300 rounded-full flex items-center justify-center ${
                    size === 'sm' ? 'h-5 w-5 text-xs' : size === 'lg' ? 'h-8 w-8 text-sm' : 'h-6 w-6 text-xs'
                  }`}
                >
                  <User className="h-3 w-3" />
                </div>
              )}
            </div>
          )}

          {/* User Name */}
          <span className="truncate max-w-32">
            {user.name || user.username || 'User'}
          </span>

          {/* Dropdown Arrow */}
          {showDropdown && (
            <ChevronDown className={`ml-2 ${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} transition-transform ${
              showMenu ? 'rotate-180' : ''
            }`} />
          )}
        </button>

        {/* User Menu */}
        {showMenu && showDropdown && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <UserMenu onClose={() => setShowMenu(false)} />
          </>
        )}
      </div>
    );
  }

  // ============================================================================
  // UNAUTHENTICATED STATE
  // ============================================================================

  return (
    <button onClick={handleLogin} className={buttonStyles}>
      <User className={`mr-2 ${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'}`} />
      {loginText}
    </button>
  );
}