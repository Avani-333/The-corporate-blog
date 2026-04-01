import DashboardLayout from '@/components/dashboard/DashboardLayout';
import DashboardOverview from '@/components/dashboard/DashboardOverview';

function DashboardPage() {
  return (
    <DashboardLayout
      title="Dashboard"
      description="Overview of your content and platform activity"
    >
      <DashboardOverview />
    </DashboardLayout>
  );
}

export default DashboardPage;