import { PrismaClient, UserRole, UserStatus, PostStatus, CommentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default categories
  const techCategory = await prisma.category.upsert({
    where: { slug: 'technology' },
    update: {},
    create: {
      name: 'Technology',
      slug: 'technology',
      description: 'Latest technology trends, tutorials, and insights',
      color: '#3B82F6',
      icon: '💻',
      seoTitle: 'Technology Articles | The Corporate Blog',
      metaDescription: 'Explore the latest technology trends, tutorials, and insights from industry experts.',
      isVisible: true,
    },
  });

  const businessCategory = await prisma.category.upsert({
    where: { slug: 'business' },
    update: {},
    create: {
      name: 'Business',
      slug: 'business',
      description: 'Business strategies, entrepreneurship, and corporate insights',
      color: '#EF4444',
      icon: '💼',
      seoTitle: 'Business Articles | The Corporate Blog',
      metaDescription: 'Discover business strategies, entrepreneurship tips, and corporate insights.',
      isVisible: true,
    },
  });

  const marketingCategory = await prisma.category.upsert({
    where: { slug: 'marketing' },
    update: {},
    create: {
      name: 'Marketing',
      slug: 'marketing',
      description: 'Digital marketing, SEO, content strategy, and growth hacking',
      color: '#10B981',
      icon: '📈',
      seoTitle: 'Marketing Articles | The Corporate Blog',
      metaDescription: 'Learn about digital marketing, SEO strategies, and content marketing best practices.',
      isVisible: true,
    },
  });

  const designCategory = await prisma.category.upsert({
    where: { slug: 'design' },
    update: {},
    create: {
      name: 'Design',
      slug: 'design',
      description: 'UI/UX design, web design trends, and creative inspiration',
      color: '#8B5CF6',
      icon: '🎨',
      seoTitle: 'Design Articles | The Corporate Blog',
      metaDescription: 'Explore UI/UX design principles, web design trends, and creative inspiration.',
      isVisible: true,
    },
  });

  console.log('✅ Created categories');

  // Create default tags
  const tags = [
    { name: 'React', slug: 'react', description: 'React.js library and ecosystem', color: '#61DAFB' },
    { name: 'Next.js', slug: 'nextjs', description: 'Next.js React framework', color: '#000000' },
    { name: 'TypeScript', slug: 'typescript', description: 'TypeScript programming language', color: '#3178C6' },
    { name: 'SEO', slug: 'seo', description: 'Search Engine Optimization', color: '#4285F4' },
    { name: 'Performance', slug: 'performance', description: 'Web performance optimization', color: '#FF6B6B' },
    { name: 'Tutorial', slug: 'tutorial', description: 'Step-by-step tutorials', color: '#FFA726' },
    { name: 'Best Practices', slug: 'best-practices', description: 'Industry best practices', color: '#66BB6A' },
    { name: 'Case Study', slug: 'case-study', description: 'Real-world case studies', color: '#AB47BC' },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
  }

  console.log('✅ Created tags');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123!', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@thecorporateblog.com' },
    update: {},
    create: {
      email: 'admin@thecorporateblog.com',
      username: 'admin',
      name: 'Admin User',
      bio: 'System Administrator for The Corporate Blog',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
      website: 'https://thecorporateblog.com',
      twitter: 'thecorporateblog',
    },
  });

  // Create editor user
  const editorUser = await prisma.user.upsert({
    where: { email: 'editor@thecorporateblog.com' },
    update: {},
    create: {
      email: 'editor@thecorporateblog.com',
      username: 'editor',
      name: 'Content Editor',
      bio: 'Managing and editing content for The Corporate Blog',
      role: UserRole.EDITOR,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  // Create author user
  const authorUser = await prisma.user.upsert({
    where: { email: 'author@thecorporateblog.com' },
    update: {},
    update: {},
    create: {
      email: 'author@thecorporateblog.com',
      username: 'johnsmith',
      name: 'John Smith',
      bio: 'Senior developer and tech writer with 10+ years of experience in web development and cloud architecture.',
      role: UserRole.AUTHOR,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
      website: 'https://johnsmith.dev',
      twitter: 'johnsmith_dev',
      github: 'johnsmith',
      linkedin: 'johnsmith-dev',
    },
  });

  console.log('✅ Created users');

  // Create sample posts
  const samplePost1 = await prisma.post.upsert({
    where: { slug: 'getting-started-with-nextjs-14' },
    update: {},
    create: {
      title: 'Getting Started with Next.js 14: A Complete Guide',
      slug: 'getting-started-with-nextjs-14',
      excerpt: 'Learn how to build modern web applications with Next.js 14, including the new App Router, Server Components, and performance optimizations.',
      content: {
        blocks: [
          {
            id: '1',
            type: 'paragraph',
            data: {
              text: 'Next.js 14 brings exciting new features and performance improvements to the React ecosystem. In this comprehensive guide, we\'ll explore the key features and learn how to build modern web applications.'
            }
          },
          {
            id: '2',
            type: 'heading',
            data: {
              text: 'What\'s New in Next.js 14',
              level: 2
            }
          },
          {
            id: '3',
            type: 'list',
            data: {
              style: 'unordered',
              items: [
                'Improved App Router performance',
                'Enhanced Server Components',
                'Better TypeScript support',
                'Optimized bundling with Turbopack'
              ]
            }
          }
        ]
      },
      contentHtml: '<p>Next.js 14 brings exciting new features and performance improvements to the React ecosystem. In this comprehensive guide, we\'ll explore the key features and learn how to build modern web applications.</p><h2>What\'s New in Next.js 14</h2><ul><li>Improved App Router performance</li><li>Enhanced Server Components</li><li>Better TypeScript support</li><li>Optimized bundling with Turbopack</li></ul>',
      seoTitle: 'Next.js 14 Guide: Build Modern Web Apps | The Corporate Blog',
      metaDescription: 'Complete guide to Next.js 14 features including App Router, Server Components, and performance optimizations. Start building today!',
      featuredImage: 'https://res.cloudinary.com/thecorporateblog/image/upload/v1/blog/nextjs-14-guide.jpg',
      featuredImageAlt: 'Next.js 14 Logo with Code Background',
      status: PostStatus.PUBLISHED,
      publishedAt: new Date('2024-01-15'),
      authorId: authorUser.id,
      viewCount: 1250,
      likeCount: 89,
      commentCount: 23,
      shareCount: 45,
      wordCount: 2800,
      readingTime: 12,
    },
  });

  const samplePost2 = await prisma.post.upsert({
    where: { slug: 'seo-optimization-best-practices-2024' },
    update: {},
    create: {
      title: 'SEO Optimization: 2024 Best Practices for Better Rankings',
      slug: 'seo-optimization-best-practices-2024',
      excerpt: 'Discover the latest SEO strategies and techniques to improve your website\'s search engine rankings in 2024.',
      content: {
        blocks: [
          {
            id: '1',
            type: 'paragraph',
            data: {
              text: 'Search Engine Optimization continues to evolve rapidly. Stay ahead of the curve with these proven SEO strategies for 2024.'
            }
          }
        ]
      },
      contentHtml: '<p>Search Engine Optimization continues to evolve rapidly. Stay ahead of the curve with these proven SEO strategies for 2024.</p>',
      seoTitle: 'SEO Best Practices 2024: Boost Your Search Rankings',
      metaDescription: 'Learn the latest SEO strategies and techniques to improve your website rankings in 2024. Expert tips and actionable advice.',
      featuredImage: 'https://res.cloudinary.com/thecorporateblog/image/upload/v1/blog/seo-2024-guide.jpg',
      featuredImageAlt: 'SEO Analytics Dashboard',
      status: PostStatus.PUBLISHED,
      publishedAt: new Date('2024-02-01'),
      authorId: authorUser.id,
      viewCount: 890,
      likeCount: 67,
      commentCount: 18,
      shareCount: 32,
      wordCount: 2200,
      readingTime: 9,
    },
  });

  console.log('✅ Created sample posts');

  // Connect posts to categories
  await prisma.postCategory.createMany({
    data: [
      { postId: samplePost1.id, categoryId: techCategory.id, order: 1 },
      { postId: samplePost2.id, categoryId: techCategory.id, order: 1 },
      { postId: samplePost2.id, categoryId: marketingCategory.id, order: 2 },
    ],
    skipDuplicates: true,
  });

  // Connect posts to tags
  const reactTag = await prisma.tag.findUnique({ where: { slug: 'react' } });
  const nextjsTag = await prisma.tag.findUnique({ where: { slug: 'nextjs' } });
  const seoTag = await prisma.tag.findUnique({ where: { slug: 'seo' } });
  const tutorialTag = await prisma.tag.findUnique({ where: { slug: 'tutorial' } });

  if (reactTag && nextjsTag && seoTag && tutorialTag) {
    await prisma.postTag.createMany({
      data: [
        { postId: samplePost1.id, tagId: reactTag.id },
        { postId: samplePost1.id, tagId: nextjsTag.id },
        { postId: samplePost1.id, tagId: tutorialTag.id },
        { postId: samplePost2.id, tagId: seoTag.id },
        { postId: samplePost2.id, tagId: tutorialTag.id },
      ],
      skipDuplicates: true,
    });
  }

  console.log('✅ Connected posts to categories and tags');

  // Create sample comments
  const regularUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      username: 'johndoe',
      name: 'John Doe',
      bio: 'Web developer and tech enthusiast',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  await prisma.comment.createMany({
    data: [
      {
        content: 'Great article! Really helped me understand the new Next.js features.',
        postId: samplePost1.id,
        userId: regularUser.id,
        status: CommentStatus.PUBLISHED,
      },
      {
        content: 'Thanks for sharing these SEO tips. Already seeing improvements in my rankings!',
        postId: samplePost2.id,
        userId: regularUser.id,
        status: CommentStatus.PUBLISHED,
      },
    ],
  });

  console.log('✅ Created sample comments');

  // Create system settings
  await prisma.setting.createMany({
    data: [
      {
        key: 'site_title',
        value: 'The Corporate Blog',
        type: 'STRING',
      },
      {
        key: 'site_description',
        value: 'Production-grade, SEO-first, serverless blogging platform built to scale to 1M+ Daily Active Users.',
        type: 'STRING',
      },
      {
        key: 'posts_per_page',
        value: '10',
        type: 'NUMBER',
      },
      {
        key: 'comments_enabled',
        value: 'true',
        type: 'BOOLEAN',
      },
      {
        key: 'registration_enabled',
        value: 'false',
        type: 'BOOLEAN',
      },
      {
        key: 'social_links',
        value: JSON.stringify({
          twitter: 'https://twitter.com/thecorporateblog',
          linkedin: 'https://linkedin.com/company/thecorporateblog',
          github: 'https://github.com/thecorporateblog'
        }),
        type: 'JSON',
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Created system settings');

  console.log('🎉 Database seeded successfully!');
  console.log('\n📊 Summary:');
  console.log(`- Categories: ${await prisma.category.count()}`);
  console.log(`- Tags: ${await prisma.tag.count()}`);
  console.log(`- Users: ${await prisma.user.count()}`);
  console.log(`- Posts: ${await prisma.post.count()}`);
  console.log(`- Comments: ${await prisma.comment.count()}`);
  console.log(`- Settings: ${await prisma.setting.count()}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });