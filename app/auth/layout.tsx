import { Metadata } from 'next';

/**
 * Auth Layout
 * Blocks all authentication routes from search engine indexing.
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
    template: '%s | The Corporate Blog',
    default: 'Sign In - The Corporate Blog',
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
