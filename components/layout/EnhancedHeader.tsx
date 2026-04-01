'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleBasedUI, RoleGate } from '@/hooks/useRoleBasedUI';
import { getRoleDisplayName, getDashboardRoute } from '@/lib/rbac';
import { UserRole } from '@/types';

// ============================================================================
// AUTHENTICATED USER MENU
// ============================================================================

function AuthenticatedUserMenu() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  
  if (!user) return null;

  const dashboardRoute = getDashboardRoute(user.role);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
      >
        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
          <span className="text-primary-700 font-medium text-sm">
            {user.name.charAt(0)}
          </span>
        </div>
        <span className="hidden md:block">{user.name}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="p-4 border-b border-gray-100">
            <div className="font-medium text-gray-900">{user.name}</div>
            <div className="text-sm text-gray-600">{user.email}</div>
            <div className="text-xs text-gray-500 mt-1">
              {getRoleDisplayName(user.role)}
            </div>
          </div>
          
          <div className="py-1">
            <Link
              href={dashboardRoute}
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <User className="w-4 h-4 mr-3" />
              Dashboard
            </Link>
            
            <Link
              href="/dashboard/profile"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="w-4 h-4 mr-3" />
              Profile Settings
            </Link>
            
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={() => {
                  signOut();
                  setIsOpen(false);
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// GUEST USER ACTIONS
// ============================================================================

function GuestUserActions() {
  return (
    <div className="flex items-center space-x-4">
      <Link
        href="/auth/login"
        className="text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        Sign In
      </Link>
      <Link
        href="/auth/register"
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
      >
        Get Started
      </Link>
    </div>
  );
}

// ============================================================================
// ROLE-BASED NAVIGATION LINKS
// ============================================================================

function RoleBasedNavLinks() {
  return (
    <div className="hidden md:flex items-center space-x-6">
      {/* Content Management Links for Authors+ */}
      <RoleGate minimumRole={UserRole.CONTRIBUTOR}>
        <Link
          href="/dashboard/posts"
          className="text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          My Posts
        </Link>
      </RoleGate>

      {/* Analytics for Editors+ */}
      <RoleGate minimumRole={UserRole.EDITOR}>
        <Link
          href="/dashboard/analytics"
          className="text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Analytics
        </Link>
      </RoleGate>

      {/* Admin Panel for Admins */}
      <RoleGate minimumRole={UserRole.ADMIN}>
        <Link
          href="/dashboard/admin"
          className="text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Admin
        </Link>
      </RoleGate>
    </div>
  );
}

// ============================================================================
// ENHANCED HEADER COMPONENT
// ============================================================================

export default function EnhancedHeader() {
  const { isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <span className="ml-3 text-xl font-bold text-gray-900">
                The Corporate Blog
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {/* Public Navigation */}
            <nav className="flex space-x-6">
              <Link
                href="/blog"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Blog
              </Link>
              <Link
                href="/categories"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Categories
              </Link>
              <Link
                href="/about"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                About
              </Link>
            </nav>

            {/* Role-based Navigation */}
            {isAuthenticated && <RoleBasedNavLinks />}

            {/* User Actions */}
            {isAuthenticated ? <AuthenticatedUserMenu /> : <GuestUserActions />}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="space-y-2">
              {/* Public Navigation */}
              <Link
                href="/blog"
                className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Blog
              </Link>
              <Link
                href="/categories"
                className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Categories
              </Link>
              <Link
                href="/about"
                className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                About
              </Link>

              {/* Authenticated User Links */}
              {isAuthenticated && (
                <>
                  <div className="border-t border-gray-200 mt-4 pt-4">
                    <RoleGate minimumRole={UserRole.CONTRIBUTOR}>
                      <Link
                        href="/dashboard/posts"
                        className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        My Posts
                      </Link>
                    </RoleGate>

                    <Link
                      href="/dashboard"
                      className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>

                    <Link
                      href="/dashboard/profile"
                      className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Profile
                    </Link>
                  </div>
                </>
              )}

              {/* Guest Actions */}
              {!isAuthenticated && (
                <div className="border-t border-gray-200 mt-4 pt-4 space-y-2">
                  <Link
                    href="/auth/login"
                    className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/register"
                    className="block px-3 py-2 text-base font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}