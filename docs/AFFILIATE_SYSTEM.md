# Affiliate & Sponsorship System

Complete system for managing sponsored posts with affiliate link tracking and analytics.

## Features

✅ **Sponsored Post Flag** - Mark posts as `is_sponsored`  
✅ **Affiliate Links** - Store and manage affiliate redirect URLs  
✅ **Click Tracking** - Track every affiliate click with metadata  
✅ **Analytics** - Detailed stats on clicks, referrers, devices, geographic distribution  
✅ **Redirect Endpoint** - `/api/r/:slug` handles tracking and redirects  
✅ **Admin APIs** - Manage links and view statistics  
✅ **UI Components** - Pre-built sponsor badges and manager component  

## Database Schema

### Post Model Changes

```typescript
model Post {
  // ... existing fields ...
  
  // New sponsorship fields
  is_sponsored    Boolean          @default(false)
  affiliateLinkVia String?         // Target URL for affiliate redirect
  affiliateClicks AffiliateClick[] // Relation to clicks
}
```

### New AffiliateClick Model

```typescript
model AffiliateClick {
  id          String   @id
  postId      String   // FK to Post
  postSlug    String   // Cached for tracking
  
  // Click metadata
  referrer    String?  // HTTP referrer
  ipAddress   String?  // Client IP
  userAgent   String?  // Browser info
  countryCode String?  // Geo-location
  deviceType  String?  // mobile/desktop/tablet
  
  // User
  userId      String?  // FK to User (if logged in)
  
  createdAt   DateTime
  
  post        Post     @relation(fields: [postId])
  user        User?    @relation(name: "affiliateClicks")
}
```

## Setup

### 1. Run Database Migration

```bash
# Generate Prisma client with new schema
npm run db:generate

# Apply migration
npm run db:push
```

### 2. Environment Variables (Optional)

```env
# For frontend tracking
NEXT_PUBLIC_AFFILIATE_TRACKING=true
```

## API Endpoints

### 1. Redirect & Track: GET `/api/r/:slug`

Handles the affiliate click flow.

**Response:**
- HTTP 302 redirect to `affiliateLinkVia` URL
- Automatically tracks click metadata
- Adds UTM parameters to redirect URL

**Example:**
```
GET /api/r/my-sponsored-post
→ 302 Redirect to https://affiliate-link.com?utm_source=blog&utm_medium=affiliate&utm_campaign=my-sponsored-post
```

**Tracks:**
- Click count (implicitly via database records)
- Referrer URL
- IP Address
- User Agent
- Country (via Cloudflare headers)
- Device Type
- User ID (if authenticated)

---

### 2. Get Statistics: GET `/api/admin/affiliate/stats`

Get click statistics for posts.

**Query Parameters:**
- `slug` (optional) - Get stats for specific post
- `limit` (optional, default: 50) - Number of recent clicks
- `recentDetails=true` (optional) - Include recent click details

**Response (Single Post):**
```jsonc
GET /api/admin/affiliate/stats?slug=my-post&recentDetails=true

{
  "data": {
    "totalClicks": 150,
    "uniqueVisitors": 120,
    "clicksByCountry": {
      "US": 85,
      "GB": 25,
      "CA": 20,
      // ...
    },
    "clicksByDevice": {
      "desktop": 100,
      "mobile": 45,
      "tablet": 5
    },
    "clicksByReferrer": {
      "google.com": 60,
      "reddit.com": 35,
      "Direct": 55
    },
    "clicksLast7Days": 42,
    "clicksLast30Days": 125,
    "clicksToday": 8,
    "averageClicksPerDay": 5
  },
  "recentClicks": [
    {
      "id": "click_123",
      "postSlug": "my-post",
      "referrer": "https://reddit.com/r/programming",
      "country": "US",
      "deviceType": "mobile",
      "createdAt": "2026-03-20T10:30:00Z"
    },
    // ... more clicks ...
  ]
}
```

**Response (All Sponsored Posts):**
```jsonc
GET /api/admin/affiliate/stats

{
  "data": [
    {
      "slug": "post-1",
      "title": "Amazing Product Review",
      "totalClicks": 150,
      "clicksLast30Days": 125,
      "lastClickDate": "2026-03-20T15:45:00Z"
    },
    // ... more posts ...
  ],
  "summary": {
    "totalSponsored": 5,
    "totalClicks": 523,
    "clicksLast30Days": 412
  }
}
```

---

### 3. Manage Affiliate Links: POST `/api/admin/affiliate/manage`

Add, update, remove, or retrieve affiliate links.

**Request Body:**
```json
{
  "action": "mark|unmark|update|get",
  "slug": "post-slug",
  "affiliateLinkVia": "https://example.com/affiliate?id=123"  // Required for mark/update
}
```

**Actions:**

#### Mark as Sponsored
```bash
curl -X POST http://localhost:3000/api/admin/affiliate/manage \
  -H "Content-Type: application/json" \
  -d '{
    "action": "mark",
    "slug": "my-post",
    "affiliateLinkVia": "https://amazon.com/dp/B123ABC"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Post \"my-post\" marked as sponsored",
  "data": {
    "slug": "my-post",
    "is_sponsored": true,
    "affiliateLinkVia": "https://amazon.com/dp/B123ABC"
  }
}
```

#### Update Affiliate Link
```bash
curl -X POST http://localhost:3000/api/admin/affiliate/manage \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update",
    "slug": "my-post",
    "affiliateLinkVia": "https://amazon.com/dp/B456XYZ"
  }'
```

#### Unmark as Sponsored
```bash
curl -X POST http://localhost:3000/api/admin/affiliate/manage \
  -H "Content-Type: application/json" \
  -d '{
    "action": "unmark",
    "slug": "my-post"
  }'
```

#### Get Current Link
```bash
curl http://localhost:3000/api/admin/affiliate/manage \
  -H "Content-Type: application/json" \
  -d '{"action": "get", "slug": "my-post"}'
```

---

## Client Components

### 1. SponsorBadge

Display on sponsored posts to show sponsorship info and CTA.

```tsx
import { SponsorBadge } from '@/components/affiliate';

export function BlogPost({ post }) {
  return (
    <article>
      {post.is_sponsored && post.affiliateLinkVia && (
        <SponsorBadge
          affiliateLinkVia={post.affiliateLinkVia}
          postSlug={post.slug}
          sponsorName="Amazon Associates"
          ctaText="Check Price on Amazon"
          size="md"
        />
      )}
      
      {/* Post content */}
    </article>
  );
}
```

**Props:**
- `affiliateLinkVia` (required) - The affiliate URL
- `postSlug` (required) - Post slug for tracking
- `sponsorName` (optional) - "Sponsored by X"
- `ctaText` (optional, default: "Learn More")
- `size` (optional, default: "md") - "sm" | "md" | "lg"
- `hideDisclosure` (optional) - Hide "Sponsored" label
- `className` (optional) - CSS classes

---

### 2. SponsorDisclosure

Minimal inline sponsor badge (for headers).

```tsx
import { SponsorDisclosure } from '@/components/affiliate';

export function PostHeader({ post }) {
  return (
    <header>
      <h1>{post.title}</h1>
      {post.is_sponsored && <SponsorDisclosure sponsorName={post.sponsor} />}
    </header>
  );
}
```

---

### 3. SponsorBanner

Larger promotional banner for sidebars.

```tsx
import { SponsorBanner } from '@/components/affiliate';

export function Sidebar({ post }) {
  return (
    <aside>
      {post.is_sponsored && (
        <SponsorBanner
          affiliateLinkVia={post.affiliateLinkVia}
          postSlug={post.slug}
          sponsorName="Acme Corp"
          sponsorDescription="Industry-leading solutions"
          sponsorLogo="https://example.com/logo.png"
        />
      )}
    </aside>
  );
}
```

---

### 4. AffiliateManager

Admin component for managing affiliate links and viewing statistics.

```tsx
import { AffiliateManager } from '@/components/affiliate';

export function PostEditor({ post }) {
  return (
    <div>
      <AffiliateManager
        postSlug={post.slug}
        currentLink={post.affiliateLinkVia}
        isSponsored={post.is_sponsored}
      />
    </div>
  );
}
```

---

## Service Functions

### lib/affiliate-service.ts

Helper functions for programmatic affiliate management.

```typescript
import {
  getAffiliateStats,
  getRecentAffiliateClicks,
  getSponsoredPostsStats,
  trackAffiliateClick,
  getAffiliateLink,
  updateAffiliateLink,
  markPostAsSponsored,
  unmarkPostAsSponsored,
} from '@/lib/affiliate-service';

// Get stats for a post
const stats = await getAffiliateStats('my-post');
console.log(`${stats.totalClicks} clicks from ${stats.uniqueVisitors} visitors`);

// Get recent clicks
const recentClicks = await getRecentAffiliateClicks('my-post', 10);

// Get all sponsored posts stats
const allStats = await getSponsoredPostsStats();

// Mark post as sponsored
await markPostAsSponsored('my-post', 'https://affiliate-link.com');

// Get current affiliate link
const link = await getAffiliateLink('my-post');
```

---

## Integration Examples

### Example 1: Basic Sponsored Post Page

```tsx
'use client';

import { SponsorBadge } from '@/components/affiliate';
import { Post } from '@prisma/client';

export function BlogPostPage({ post }: { post: Post }) {
  return (
    <article className="max-w-3xl mx-auto py-12">
      <header className="mb-8">
        <h1>{post.title}</h1>
        <p className="text-gray-600">{post.seoTitle}</p>
      </header>

      {/* Sponsor section */}
      {post.is_sponsored && post.affiliateLinkVia && (
        <div className="mb-8">
          <SponsorBadge
            affiliateLinkVia={post.affiliateLinkVia}
            postSlug={post.slug}
            sponsorName="Premium Partner"
            ctaText="Learn More"
          />
        </div>
      )}

      {/* Content */}
      <div className="prose">
        {/* ... post content ... */}
      </div>
    </article>
  );
}
```

---

### Example 2: Admin Dashboard

```tsx
'use client';

import { AffiliateManager } from '@/components/affiliate';
import { getSponsoredPostsStats } from '@/lib/affiliate-service';
import { useEffect, useState } from 'react';

export function AffiliatesDashboard() {
  const [stats, setStats] = useState([]);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);

  useEffect(() => {
    getSponsoredPostsStats().then(setStats);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Affiliate Management</h1>

      {/* Stats Overview */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-gray-600 text-sm">Total Clicks</p>
          <p className="text-3xl font-bold">
            {stats.reduce((sum, p) => sum + p.totalClicks, 0)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-gray-600 text-sm">Sponsored Posts</p>
          <p className="text-3xl font-bold">{stats.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-gray-600 text-sm">Last 30 Days</p>
          <p className="text-3xl font-bold">
            {stats.reduce((sum, p) => sum + p.clicksLast30Days, 0)}
          </p>
        </div>
      </div>

      {/* Posts Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Post</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Total Clicks</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Last 30 Days</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((post) => (
              <tr key={post.slug} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium">{post.title}</td>
                <td className="px-4 py-3 text-sm">{post.totalClicks}</td>
                <td className="px-4 py-3 text-sm">{post.clicksLast30Days}</td>
                <td className="px-4 py-3 text-sm">
                  <button
                    onClick={() => setSelectedPost(post.slug)}
                    className="text-blue-600 hover:underline text-sm font-medium"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Manager */}
      {selectedPost && (
        <AffiliateManager
          postSlug={selectedPost}
          currentLink={stats.find(p => p.slug === selectedPost)?.affiliateLinkVia}
          isSponsored={true}
        />
      )}
    </div>
  );
}
```

---

## Tracking Metadata

The `/api/r/:slug` endpoint automatically captures:

| Field | Source | Example |
|-------|--------|---------|
| `referrer` | HTTP Referer header | `https://reddit.com/r/programming` |
| `ipAddress` | CF-Connecting-IP, X-Forwarded-For | `192.168.1.1` |
| `userAgent` | User-Agent header | `Mozilla/5.0...` |
| `countryCode` | CF-IPCountry header | `US`, `GB`, `CA` |
| `deviceType` | User-Agent parsing | `mobile`, `desktop`, `tablet` |
| `userId` | x-user-id header (if auth) | `user_123` |

---

## Security Considerations

1. **Add Authentication**: Uncomment auth checks in `/api/admin/*` endpoints
2. **Rate Limiting**: Consider rate limiting `/api/r/:slug` to prevent abuse
3. **UTM Parameters**: These are added automatically but can be customized
4. **IP Anonymization**: Consider hashing IPs before storage in production
5. **HTTPS Only**: Always use HTTPS for affiliate links

---

## Monitoring & Alerts

```typescript
// Example: Alert if click count drops suddenly
const today = await getAffiliateStats('my-post');
const yesterday = await getYesterdayStats('my-post');

if (today.clicksToday < yesterday.clicksToday * 0.5) {
  console.warn('⚠️ Affiliate clicks down 50%+');
  // Send alert
}
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Clicks not tracking | Check `/api/r/:slug` endpoint is accessible |
| Stats showing 0 | Run migration: `npm run db:push` |
| Redirect not working | Verify `affiliateLinkVia` is a valid URL |
| Missing country data | Enable Cloudflare headers on server |

---

## Performance

- **Affiliate redirect**: ~50-100ms (database write + redirect)
- **Stats queries**: ~200-500ms (depends on click volume)
- **Click tracking**: Asynchronous, doesn't block redirect

---

For questions or issues, check the [main documentation](./README.md).
