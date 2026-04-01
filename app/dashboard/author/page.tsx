import { 
  FileText,
  PlusCircle,
  Clock,
  TrendingUp,
  Eye,
  Heart,
  MessageSquare,
  Calendar,
  Edit3,
  MoreHorizontal,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

// ============================================================================
// AUTHOR STATS
// ============================================================================

function AuthorStats() {
  const stats = [
    {
      title: 'Published Posts',
      value: '24',
      change: '+3 this month',
      changeType: 'positive' as const,
      icon: FileText,
      href: '/dashboard/posts',
    },
    {
      title: 'Draft Posts',
      value: '8',
      change: '2 ready to publish',
      changeType: 'neutral' as const,
      icon: Edit3,
      href: '/dashboard/posts/drafts',
    },
    {
      title: 'Total Views',
      value: '12.5K',
      change: '+15% this month',
      changeType: 'positive' as const,
      icon: Eye,
    },
    {
      title: 'Total Likes',
      value: '342',
      change: '+28 this week',
      changeType: 'positive' as const,
      icon: Heart,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const content = (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
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

        return stat.href ? (
          <a key={index} href={stat.href} className="hover:shadow-md transition-shadow">
            {content}
          </a>
        ) : (
          <div key={index}>{content}</div>
        );
      })}
    </div>
  );
}

// ============================================================================
// RECENT POSTS
// ============================================================================

function RecentPosts() {
  const posts = [
    {
      id: '1',
      title: 'Advanced React Patterns for Modern Applications',
      status: 'published' as const,
      publishedAt: '2024-03-05',
      views: 1234,
      likes: 45,
      comments: 12,
    },
    {
      id: '2',
      title: 'Understanding TypeScript Generics',
      status: 'published' as const,
      publishedAt: '2024-03-03',
      views: 987,
      likes: 38,
      comments: 8,
    },
    {
      id: '3',
      title: 'Modern CSS Techniques You Should Know',
      status: 'draft' as const,
      updatedAt: '2024-03-06',
      views: 0,
      likes: 0,
      comments: 0,
    },
    {
      id: '4',
      title: 'Building Scalable Node.js Applications',
      status: 'scheduled' as const,
      scheduledFor: '2024-03-10',
      views: 0,
      likes: 0,
      comments: 0,
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      published: { label: 'Published', color: 'bg-green-100 text-green-800' },
      draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
      scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-800' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Recent Posts</h3>
        <a 
          href="/dashboard/posts"
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          View all
        </a>
      </div>
      <div className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Engagement
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {posts.map(post => (
              <tr key={post.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900 hover:text-primary-700">
                    <a href={`/dashboard/posts/${post.id}`}>
                      {post.title}
                    </a>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {getStatusBadge(post.status)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {post.status === 'published' && post.publishedAt}
                  {post.status === 'draft' && post.updatedAt}
                  {post.status === 'scheduled' && post.scheduledFor}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Eye className="h-4 w-4 mr-1" />
                      {post.views}
                    </div>
                    <div className="flex items-center">
                      <Heart className="h-4 w-4 mr-1" />
                      {post.likes}
                    </div>
                    <div className="flex items-center">
                      <MessageSquare className="h-4 w-4 mr-1" />
                      {post.comments}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium">
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// CONTENT GOALS
// ============================================================================

function ContentGoals() {
  const goals = [
    {
      title: 'Weekly Publishing Goal',
      current: 2,
      target: 3,
      unit: 'posts',
      color: 'blue',
    },
    {
      title: 'Monthly Views Target',
      current: 8200,
      target: 10000,
      unit: 'views',
      color: 'green',
    },
    {
      title: 'Engagement Rate',
      current: 4.2,
      target: 5.0,
      unit: '%',
      color: 'purple',
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Content Goals</h3>
      </div>
      <div className="p-6 space-y-6">
        {goals.map((goal, index) => {
          const percentage = (goal.current / goal.target) * 100;
          const isComplete = percentage >= 100;
          
          return (
            <div key={index}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {isComplete ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-gray-400 mr-2" />
                  )}
                  <span className="text-sm font-medium text-gray-900">{goal.title}</span>
                </div>
                <span className="text-sm text-gray-600">
                  {goal.current} / {goal.target} {goal.unit}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    goal.color === 'blue' ? 'bg-blue-600' :
                    goal.color === 'green' ? 'bg-green-600' : 'bg-purple-600'
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {percentage.toFixed(1)}% complete
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// WRITING SCHEDULE
// ============================================================================

function WritingSchedule() {
  const schedule = [
    {
      date: '2024-03-08',
      title: 'Modern CSS Techniques You Should Know',
      status: 'draft',
      time: '10:00 AM',
    },
    {
      date: '2024-03-10',
      title: 'Building Scalable Node.js Applications',
      status: 'scheduled',
      time: '2:00 PM',
    },
    {
      date: '2024-03-12',
      title: 'Database Design Best Practices',
      status: 'draft',
      time: '11:00 AM',
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Publishing Schedule</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {schedule.map((item, index) => (
          <div key={index} className="px-6 py-4 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-600">{item.date} at {item.time}</p>
                </div>
              </div>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                item.status === 'scheduled' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN AUTHOR DASHBOARD
// ============================================================================

function AuthorDashboard() {
  return (
    <DashboardLayout
      title="Author Dashboard"
      description="Manage your content and track performance"
      actions={
        <a
          href="/dashboard/posts/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Post
        </a>
      }
    >
      <div className="space-y-8">
        {/* Author Stats */}
        <AuthorStats />

        {/* Content Goals & Schedule */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ContentGoals />
          <WritingSchedule />
        </div>

        {/* Recent Posts */}
        <RecentPosts />
      </div>
    </DashboardLayout>
  );
}

export default AuthorDashboard;