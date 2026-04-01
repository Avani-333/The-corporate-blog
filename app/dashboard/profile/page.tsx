'use client';

import { useState } from 'react';
import { 
  User,
  Mail,
  Shield,
  Edit3,
  Save,
  X,
  Camera,
  Key,
  Bell,
  Globe,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { withRoleProtection } from '@/hooks/useRoleBasedUI';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { getRoleDisplayName, getRoleColor } from '@/lib/rbac';
import { UserRole } from '@/types';

// ============================================================================
// PROFILE INFORMATION
// ============================================================================

function ProfileInformation() {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    username: user?.username || '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Update user in auth context
      updateUser(formData);
      
      // Optionally sync with backend
      try {
        await fetch('/api/auth/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } catch (err) {
        console.warn('Failed to sync profile with backend:', err);
      }
      
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      username: user?.username || '',
    });
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200"
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Edit
          </button>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </button>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <div className="flex items-start space-x-6">
          {/* Avatar */}
          <div className="relative">
            <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <span className="text-primary-700 text-2xl font-semibold">
                  {user?.name?.charAt(0) || 'U'}
                </span>
              )}
            </div>
            {isEditing && (
              <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border border-gray-200 hover:bg-gray-50">
                <Camera className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>

          {/* Form */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              ) : (
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-900">{user?.name}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              {isEditing ? (
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              ) : (
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-900">{user?.email}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">@</span>
                  <span className="text-gray-900">{user?.username || 'Not set'}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-gray-500" />
                {user && (
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getRoleColor(user.role)}`}>
                    {getRoleDisplayName(user.role)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ACCOUNT SETTINGS
// ============================================================================

function AccountSettings() {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    browserNotifications: false,
    marketingEmails: false,
    twoFactorAuth: false,
    publicProfile: true,
  });

  const settingItems = [
    {
      key: 'emailNotifications',
      label: 'Email Notifications',
      description: 'Receive notifications about your content and activity',
      icon: Mail,
    },
    {
      key: 'browserNotifications',
      label: 'Browser Notifications',
      description: 'Get real-time notifications in your browser',
      icon: Bell,
    },
    {
      key: 'marketingEmails',
      label: 'Marketing Emails',
      description: 'Receive updates about new features and tips',
      icon: Mail,
    },
    {
      key: 'twoFactorAuth',
      label: 'Two-Factor Authentication',
      description: 'Add an extra layer of security to your account',
      icon: Key,
    },
    {
      key: 'publicProfile',
      label: 'Public Profile',
      description: 'Make your profile visible to other users',
      icon: Globe,
    },
  ];

  const toggleSetting = (key: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Account Settings</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {settingItems.map(item => {
          const Icon = item.icon;
          const isEnabled = settings[item.key as keyof typeof settings];
          
          return (
            <div key={item.key} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <Icon className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">{item.label}</h4>
                    <p className="text-sm text-gray-600">{item.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSetting(item.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    isEnabled ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// ACTIVITY SUMMARY
// ============================================================================

function ActivitySummary() {
  const { user } = useAuth();
  
  // Mock activity data
  const stats = [
    { label: 'Posts Created', value: '12', period: 'Last 30 days' },
    { label: 'Comments Made', value: '34', period: 'Last 30 days' },
    { label: 'Profile Views', value: '156', period: 'Last 30 days' },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Activity Summary</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm font-medium text-gray-600">{stat.label}</div>
              {stat.period && (
                <div className="text-xs text-gray-500 mt-1">{stat.period}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PROFILE PAGE
// ============================================================================

function ProfilePage() {
  return (
    <DashboardLayout
      title="Profile"
      description="Manage your account information and preferences"
    >
      <div className="space-y-8">
        {/* Profile Information */}
        <ProfileInformation />
        
        {/* Settings & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <AccountSettings />
          <ActivitySummary />
        </div>
      </div>
    </DashboardLayout>
  );
}

// Protect profile page - require authentication (any authenticated user)
export default withRoleProtection(ProfilePage, UserRole.SUBSCRIBER);