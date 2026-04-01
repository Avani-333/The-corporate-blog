import { 
  Settings,
  Shield,
  Users,
  BarChart3,
  Database,
  Globe,
  Mail,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

// ============================================================================
// SYSTEM STATUS WIDGETS
// ============================================================================

interface StatusCardProps {
  title: string;
  status: 'healthy' | 'warning' | 'error';
  description: string;
  lastChecked?: string;
}

function StatusCard({ title, status, description, lastChecked }: StatusCardProps) {
  const statusConfig = {
    healthy: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      iconColor: 'text-green-500',
      borderColor: 'border-green-200',
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-500',
      borderColor: 'border-yellow-200',
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      iconColor: 'text-red-500',
      borderColor: 'border-red-200',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start">
        <Icon className={`h-5 w-5 mt-0.5 ${config.iconColor}`} />
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
          {lastChecked && (
            <p className="text-xs text-gray-500 mt-2">Last checked: {lastChecked}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ADMIN STATS
// ============================================================================

function AdminStats() {
  const stats = [
    {
      title: 'Total Users',
      value: '1,234',
      change: '+45 this week',
      changeType: 'positive' as const,
      icon: Users,
    },
    {
      title: 'Total Posts',
      value: '456',
      change: '+12 published',
      changeType: 'positive' as const,
      icon: BarChart3,
    },
    {
      title: 'Server Load',
      value: '23%',
      change: 'Normal range',
      changeType: 'neutral' as const,
      icon: Database,
    },
    {
      title: 'Uptime',
      value: '99.9%',
      change: '30 days',
      changeType: 'positive' as const,
      icon: Globe,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <Icon className="h-8 w-8 text-primary-600" />
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-600">{stat.title}</div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className={`text-sm ${
                  stat.changeType === 'positive' ? 'text-green-600' : 
                  stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {stat.change}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// SYSTEM STATUS
// ============================================================================

function SystemStatus() {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">System Status</h3>
      </div>
      <div className="p-6 space-y-4">
        <StatusCard
          title="Database"
          status="healthy"
          description="All database connections are operational"
          lastChecked="2 minutes ago"
        />
        <StatusCard
          title="CDN Performance"
          status="healthy"
          description="Content delivery network is performing optimally"
          lastChecked="5 minutes ago"
        />
        <StatusCard
          title="Email Service"
          status="warning"
          description="Slight delay in email delivery (2-3 minutes)"
          lastChecked="1 minute ago"
        />
        <StatusCard
          title="Search Index"
          status="healthy"
          description="Search indexing is up to date"
          lastChecked="10 minutes ago"
        />
      </div>
    </div>
  );
}

// ============================================================================
// QUICK ADMIN ACTIONS
// ============================================================================

function QuickAdminActions() {
  const actions = [
    {
      title: 'User Management',
      description: 'Manage user accounts and permissions',
      icon: Users,
      href: '/dashboard/users',
      color: 'blue',
    },
    {
      title: 'System Settings',
      description: 'Configure platform settings',
      icon: Settings,
      href: '/dashboard/admin/general',
      color: 'gray',
    },
    {
      title: 'Security Settings',
      description: 'Manage security and access controls',
      icon: Shield,
      href: '/dashboard/admin/security',
      color: 'red',
    },
    {
      title: 'Analytics',
      description: 'View detailed platform analytics',
      icon: BarChart3,
      href: '/dashboard/analytics',
      color: 'green',
    },
    {
      title: 'Email Templates',
      description: 'Customize email notifications',
      icon: Mail,
      href: '/dashboard/admin/email',
      color: 'purple',
    },
    {
      title: 'Integrations',
      description: 'Manage third-party integrations',
      icon: Zap,
      href: '/dashboard/admin/integrations',
      color: 'yellow',
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Admin Actions</h3>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <a
              key={index}
              href={action.href}
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all group"
            >
              <div className={`flex-shrink-0 p-2 bg-${action.color}-100 rounded-lg group-hover:bg-${action.color}-200 transition-colors`}>
                <Icon className={`h-5 w-5 text-${action.color}-600`} />
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-medium text-gray-900 group-hover:text-primary-700">
                  {action.title}
                </h4>
                <p className="text-sm text-gray-600">{action.description}</p>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// RECENT ADMIN ACTIVITY
// ============================================================================

function RecentAdminActivity() {
  const activities = [
    {
      action: 'User role changed',
      details: 'john.doe@example.com promoted to Editor',
      user: 'Admin',
      timestamp: '2 hours ago',
    },
    {
      action: 'Security setting updated',
      details: 'Two-factor authentication enabled for admin users',
      user: 'System',
      timestamp: '4 hours ago',
    },
    {
      action: 'Integration activated',
      details: 'Google Analytics integration enabled',
      user: 'Admin',
      timestamp: '6 hours ago',
    },
    {
      action: 'User account suspended',
      details: 'spammer@example.com suspended for TOS violation',
      user: 'Admin',
      timestamp: '8 hours ago',
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Recent Admin Activity</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {activities.map((activity, index) => (
          <div key={index} className="px-6 py-4">
            <div className="flex items-start">
              <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                <p className="text-sm text-gray-600">{activity.details}</p>
                <div className="flex items-center mt-2 text-xs text-gray-500">
                  <span>{activity.user}</span>
                  <span className="mx-2">•</span>
                  <span>{activity.timestamp}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN ADMIN DASHBOARD
// ============================================================================

function AdminDashboard() {
  return (
    <DashboardLayout
      title="Administration"
      description="System overview and administrative controls"
    >
      <div className="space-y-8">
        {/* Admin Stats */}
        <AdminStats />

        {/* System Status & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SystemStatus />
          <QuickAdminActions />
        </div>

        {/* Recent Activity */}
        <RecentAdminActivity />
      </div>
    </DashboardLayout>
  );
}

export default AdminDashboard;