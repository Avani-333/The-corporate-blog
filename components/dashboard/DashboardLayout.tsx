'use client';

import { ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Settings, 
  Bell, 
  Search, 
  Menu, 
  X,
  ChevronDown,
  LogOut,
  UserCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleBasedUI } from '@/hooks/useRoleBasedUI';
import { getRoleDisplayName, getRoleColor } from '@/lib/rbac';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardBreadcrumbs from '@/components/dashboard/DashboardBreadcrumbs';

// ============================================================================
// DASHBOARD LAYOUT COMPONENT
// ============================================================================

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export default function DashboardLayout({ 
  children, 
  title, 
  description, 
  actions 
}: DashboardLayoutProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const rbac = useRoleBasedUI();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Handle sign out
  const handleSignOut = () => {
    signOut();
    router.push('/');
  };

  // Mock notifications (would come from API)
  const notifications = [
    { id: 1, title: 'New comment on your post', time: '2 min ago', unread: true },
    { id: 2, title: 'Site maintenance scheduled', time: '1 hour ago', unread: true },
    { id: 3, title: 'Weekly analytics report ready', time: '3 hours ago', unread: false },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <DashboardSidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top navigation bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            {/* Left side - Mobile menu button */}
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              {/* Page title */}
              <div className="ml-4 lg:ml-0">
                <h1 className="text-xl font-semibold text-gray-900">
                  {title || 'Dashboard'}
                </h1>
                {description && (
                  <p className="text-sm text-gray-600">{description}</p>
                )}
              </div>
            </div>

            {/* Right side - Search, notifications, user menu */}
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative hidden md:block">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md relative"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
                        <button className="text-xs text-primary-600 hover:text-primary-700">
                          Mark all read
                        </button>
                      </div>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {notifications.map(notification => (
                          <div key={notification.id} className="flex space-x-3">
                            <div className={`flex-shrink-0 w-2 h-2 mt-2 rounded-full ${
                              notification.unread ? 'bg-primary-500' : 'bg-gray-300'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900">{notification.title}</p>
                              <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-3 p-2 text-sm bg-white hover:bg-gray-50 rounded-md"
                >
                  <div className="flex-shrink-0">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <UserCircle className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="font-medium text-gray-900">{user?.name}</div>
                    <div className="text-xs text-gray-500">
                      {user && getRoleDisplayName(user.role)}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {/* User dropdown menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                    <div className="p-4 border-b border-gray-100">
                      <div className="font-medium text-gray-900">{user?.name}</div>
                      <div className="text-sm text-gray-600">{user?.email}</div>
                      {user && (
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border mt-2 ${getRoleColor(user.role)}`}>
                          {getRoleDisplayName(user.role)}
                        </div>
                      )}
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          router.push('/dashboard/profile');
                          setUserMenuOpen(false);
                        }}
                        className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <User className="w-4 h-4 mr-3" />
                        Your Profile
                      </button>
                      <button
                        onClick={() => {
                          router.push('/dashboard/settings');
                          setUserMenuOpen(false);
                        }}
                        className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Settings className="w-4 h-4 mr-3" />
                        Settings
                      </button>
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <LogOut className="w-4 h-4 mr-3" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page header with breadcrumbs and actions */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6">
            <div className="flex items-center justify-between py-4">
              <DashboardBreadcrumbs />
              {actions && (
                <div className="flex items-center space-x-3">
                  {actions}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content area */}
        <main className="flex-1">
          <div className="px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-gray-600 bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Click outside to close dropdowns */}
      {(userMenuOpen || notificationsOpen) && (
        <div 
          className="fixed inset-0 z-10"
          onClick={() => {
            setUserMenuOpen(false);
            setNotificationsOpen(false);
          }}
        />
      )}
    </div>
  );
}