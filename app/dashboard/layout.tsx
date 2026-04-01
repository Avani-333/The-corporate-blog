import { Metadata } from 'next';

/**
 * Dashboard Layout
 * Blocks all dashboard routes from search engine indexing.
 */

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
      noimageindex: true,
    },
  },
  title: {
    template: '%s | Dashboard - The Corporate Blog',
    default: 'Dashboard - The Corporate Blog',
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
