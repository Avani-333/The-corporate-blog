/**
 * Database Health Dashboard Page
 * admin/dashboard/health page showing real-time database metrics
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import DatabaseHealthDashboard from '@/components/dashboard/DatabaseHealthDashboard';

export const metadata: Metadata = {
  title: 'Database Health Dashboard | Admin Panel',
  description: 'Real-time database health monitoring and metrics',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DatabaseHealthPage() {
  // In production, add authentication check here
  // const session = await getServerSession();
  // if (!session?.user?.isAdmin) {
  //   redirect('/login');
  // }

  return (
    <div className="min-h-screen bg-gray-50">
      <DatabaseHealthDashboard />
    </div>
  );
}
