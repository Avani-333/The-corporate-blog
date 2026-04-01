import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Corporate Blog',
    short_name: 'TCB',
    description: 'Production-grade, SEO-first blogging platform delivering insights on technology, business, and innovation.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0ea5e9',
    orientation: 'portrait-primary',
    scope: '/',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-256.png',
        sizes: '256x256',
        type: 'image/png',
      },
      {
        src: '/icon-384.png',
        sizes: '384x384',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['business', 'technology', 'news', 'education'],
    shortcuts: [
      {
        name: 'Latest Articles',
        short_name: 'Latest',
        description: 'View the latest published articles',
        url: '/blog',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Categories',
        short_name: 'Categories',
        description: 'Browse articles by category',
        url: '/categories',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}