# Database Implementation - The Corporate Blog

## 🗄️ Database Schema Overview

The Corporate Blog uses PostgreSQL with Prisma ORM for type-safe database operations. The schema is designed to support a production-grade blogging platform with advanced features like multi-category posts, comprehensive user roles, and scalable content management.

## 📊 Database Models

### Core Models

#### **User Model**
- **Purpose**: User authentication, profiles, and role-based access control
- **Key Features**: 
  - 8 different user roles (SUPER_ADMIN to USER)
  - Social links integration
  - Activity tracking (last login, email verification)
  - Comprehensive profile management

```typescript
// Example: Create a new user
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    username: 'johndoe',
    name: 'John Doe',
    role: UserRole.AUTHOR,
    status: UserStatus.ACTIVE,
  },
});
```

#### **Post Model**
- **Purpose**: Blog post content management with block-based editor
- **Key Features**:
  - JSON-based block content storage
  - SEO optimization fields
  - Publishing workflow (draft, published, scheduled)
  - Analytics integration (views, likes, comments)
  - Reading time calculation

```typescript
// Example: Create a new post
const post = await prisma.post.create({
  data: {
    title: 'My Blog Post',
    slug: 'my-blog-post',
    content: { blocks: [...] }, // Block editor content
    status: PostStatus.PUBLISHED,
    authorId: user.id,
    publishedAt: new Date(),
  },
});
```

#### **Category Model**
- **Purpose**: Hierarchical content organization
- **Key Features**:
  - Parent-child relationships for subcategories
  - SEO metadata for category pages
  - Visual customization (colors, icons)
  - Many-to-many relationship with posts

#### **PostCategory Junction Table**
- **Purpose**: Many-to-many relationship between posts and categories
- **Key Features**:
  - Ordering support for category display
  - Timestamp tracking for relationships

```typescript
// Example: Add categories to a post
await prisma.postCategory.createMany({
  data: [
    { postId: post.id, categoryId: techCategory.id, order: 1 },
    { postId: post.id, categoryId: businessCategory.id, order: 2 },
  ],
});
```

#### **Tag Model & PostTag Junction**
- **Purpose**: Flexible content tagging system
- **Key Features**:
  - Many-to-many relationship with posts
  - Color coding for UI consistency
  - SEO-friendly slugs

#### **Image Model**
- **Purpose**: Media asset management with Cloudinary integration
- **Key Features**:
  - Cloudinary public ID tracking
  - Usage analytics
  - Thumbnail URL management
  - File metadata (size, dimensions, MIME type)

```typescript
// Example: Upload and track an image
const image = await prisma.image.create({
  data: {
    filename: 'hero-image.jpg',
    originalName: 'My Hero Image.jpg',
    url: 'https://res.cloudinary.com/...',
    publicId: 'blog/hero-image',
    width: 1200,
    height: 630,
    size: 145632,
    mimeType: 'image/jpeg',
    uploaderId: user.id,
  },
});
```

### Supporting Models

#### **Comment Model**
- Threaded comment system with parent-child relationships
- Moderation workflow (published, pending, spam)
- Author attribution and timestamp tracking

#### **Engagement Models**
- **PostView**: Track post views with analytics data
- **PostLike**: User post interactions
- **AuditLog**: System activity tracking

#### **System Models**
- **Setting**: Configuration management
- **Account/Session**: NextAuth.js integration
- **VerificationToken**: Email verification

## 🔍 Database Indexes

Performance-optimized indexes on frequently queried fields:

### Primary Indexes
```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- Posts  
CREATE INDEX idx_posts_status_published_at ON posts(status, published_at);
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_created_at ON posts(created_at);

-- Categories
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_visible ON categories(is_visible);

-- Performance Indexes
CREATE INDEX idx_post_views_post_id ON post_views(post_id);
CREATE INDEX idx_post_categories_post_id ON post_categories(post_id);
CREATE INDEX idx_post_categories_category_id ON post_categories(category_id);
```

## 🎭 User Roles & Permissions

### Role Hierarchy
1. **SUPER_ADMIN** - Full system access
2. **ADMIN** - Site administration  
3. **EDITOR** - Content editing and publishing
4. **AUTHOR** - Content creation
5. **CONTRIBUTOR** - Limited content creation
6. **MODERATOR** - Comment and user moderation
7. **SUBSCRIBER** - Premium content access
8. **USER** - Basic user access

### Permission Helper Functions

```typescript
import { hasPermission, canEditPost } from '@/lib/database';

// Check if user can perform action
const canEdit = hasPermission(user.role, UserRole.EDITOR);

// Check if user can edit specific post
const canEditThisPost = canEditPost(user.role, post.authorId, user.id);
```

## 🚀 Getting Started

### 1. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (development)
npm run db:push

# Run migrations (production)
npm run db:migrate

# Seed database with sample data
npm run db:seed

# Complete setup (generate + push + seed)
npm run db:setup
```

### 2. Environment Variables

Create `.env.local` with database connection:

```env
# Database URLs (from Neon)
POSTGRES_PRISMA_URL="postgresql://user:pass@host/db?pgbouncer=true&connect_timeout=15"
POSTGRES_URL_NON_POOLING="postgresql://user:pass@host/db"

# Direct database URL for migrations
DATABASE_URL="postgresql://user:pass@host/db"
```

### 3. Using the Database

```typescript
import { prisma } from '@/lib/prisma';
import { POST_INCLUDES, getPublishedPostsWhere } from '@/lib/database';

// Get published posts with relations
const posts = await prisma.post.findMany({
  where: getPublishedPostsWhere(),
  include: POST_INCLUDES.summary,
  orderBy: { publishedAt: 'desc' },
  take: 10,
});

// Get post by slug with full data
const post = await prisma.post.findUnique({
  where: { slug: 'my-post-slug' },
  include: POST_INCLUDES.full,
});

// Get posts by category
const categoryPosts = await prisma.post.findMany({
  where: {
    categories: {
      some: {
        category: { slug: 'technology' }
      }
    },
    status: PostStatus.PUBLISHED,
  },
  include: POST_INCLUDES.summary,
});
```

## 📈 Performance Optimization

### Query Optimization Patterns

#### 1. Use Appropriate Includes
```typescript
// ✅ Good: Use specific includes for different contexts
const postSummary = await prisma.post.findMany({
  include: POST_INCLUDES.summary, // Minimal data for listings
});

const postDetail = await prisma.post.findUnique({
  include: POST_INCLUDES.full, // Full data for single post
});
```

#### 2. Leverage Database-Level Counting
```typescript
// ✅ Good: Use Prisma's count functionality
const postsWithCounts = await prisma.post.findMany({
  include: {
    _count: {
      select: {
        comments: true,
        likes: true,
      },
    },
  },
});
```

#### 3. Efficient Pagination
```typescript
// ✅ Good: Cursor-based pagination for better performance
const posts = await prisma.post.findMany({
  take: 10,
  cursor: lastPost ? { id: lastPost.id } : undefined,
  skip: lastPost ? 1 : 0,
  orderBy: { publishedAt: 'desc' },
});
```

### Connection Pool Management

The database uses connection pooling through PgBouncer for optimal performance:

- **Connection pooling** enabled for all read operations
- **Direct connections** used for migrations and schema updates
- **Automatic disconnection** on process termination

## 🔧 Database Operations

### Common Queries

#### Get Posts with Categories and Tags
```typescript
const postsWithMeta = await prisma.post.findMany({
  where: getPublishedPostsWhere(),
  include: {
    author: { select: { id: true, name: true, username: true } },
    categories: {
      include: { category: true },
      orderBy: { order: 'asc' },
    },
    tags: {
      include: { tag: true },
    },
  },
});
```

#### Create Post with Categories
```typescript
const newPost = await prisma.post.create({
  data: {
    title: 'New Post',
    slug: 'new-post',
    content: { blocks: [] },
    authorId: user.id,
    categories: {
      create: [
        { categoryId: 'cat1', order: 1 },
        { categoryId: 'cat2', order: 2 },
      ],
    },
  },
});
```

#### Update Post Categories
```typescript
// Remove existing categories and add new ones
await prisma.postCategory.deleteMany({
  where: { postId: post.id },
});

await prisma.postCategory.createMany({
  data: newCategories.map((categoryId, index) => ({
    postId: post.id,
    categoryId,
    order: index + 1,
  })),
});
```

### Analytics Queries

#### Popular Posts
```typescript
const popularPosts = await prisma.post.findMany({
  where: getPublishedPostsWhere(),
  orderBy: [
    { viewCount: 'desc' },
    { likeCount: 'desc' },
  ],
  take: 10,
  include: POST_INCLUDES.summary,
});
```

#### Category Statistics
```typescript
const categoryStats = await prisma.category.findMany({
  include: {
    _count: {
      select: {
        posts: {
          where: { post: getPublishedPostsWhere() },
        },
      },
    },
  },
  orderBy: {
    posts: {
      _count: 'desc',
    },
  },
});
```

## 🧪 Testing

### Database Testing Setup
```typescript
// tests/helpers/database.ts
import { prisma } from '@/lib/prisma';

export async function cleanupDatabase() {
  await prisma.$transaction([
    prisma.postCategory.deleteMany(),
    prisma.postTag.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.post.deleteMany(),
    prisma.category.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function createTestUser() {
  return await prisma.user.create({
    data: {
      email: 'test@example.com',
      username: 'testuser',
      name: 'Test User',
      role: UserRole.AUTHOR,
    },
  });
}
```

## 📝 Migration Best Practices

### Creating Migrations
```bash
# Create a new migration
npx prisma migrate dev --name add_featured_posts

# Deploy migrations to production
npm run db:deploy
```

### Migration Guidelines
1. **Always backup** before running migrations in production
2. **Test migrations** in staging environment first
3. **Use transactions** for complex data transformations
4. **Add indexes** during low-traffic periods
5. **Consider downtime** for breaking changes

## 🔒 Security Considerations

### Data Protection
- **Parameterized queries** through Prisma (SQL injection protection)
- **Row-level security** through application logic
- **Sensitive data encryption** at application level
- **Audit logging** for all critical operations

### Access Control
- **Role-based permissions** enforced at application level
- **User status checks** before data access
- **Admin action logging** through AuditLog model

## 🚨 Troubleshooting

### Common Issues

#### Connection Issues
```bash
# Check database connection
npm run db:studio

# Regenerate Prisma client
npm run db:generate

# Reset database (development only)
npm run db:reset
```

#### Performance Issues
```typescript
// Enable query logging
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Monitor slow queries
process.env.DEBUG = 'prisma:query';
```

#### Migration Issues
```bash
# Reset migrations (development only)
npx prisma migrate reset

# Mark migration as applied without running
npx prisma migrate resolve --applied "migration_name"
```

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [Database Design Best Practices](https://www.postgresql.org/docs/current/ddl.html)
- [Neon Database Documentation](https://neon.tech/docs)