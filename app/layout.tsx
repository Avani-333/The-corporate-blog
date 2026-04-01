import './globals.css';
import { Inter, Merriweather, Fira_Code } from 'next/font/google';
import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { Providers } from './providers';
import { generateMetadata } from '@/lib/metadata';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const merriweather = Merriweather({
  weight: ['300', '400', '700', '900'],
  subsets: ['latin'],
  variable: '--font-merriweather',
  display: 'swap',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira-code',
  display: 'swap',
});

export const metadata = generateMetadata({
  title: 'The Corporate Blog - Production-Grade Blogging Platform',
  description: 'SEO-first, serverless blogging platform built to scale. Modern CMS with structured content, analytics, and monetization ready.',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0ea5e9' },
    { media: '(prefers-color-scheme: dark)', color: '#0284c7' },
  ],
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${merriweather.variable} ${firaCode.variable}`}
    >
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}