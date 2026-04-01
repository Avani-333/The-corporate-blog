# Security Hardening Implementation Guide

## Overview
Comprehensive security hardening for The Corporate Blog with refresh token rotation, blacklisting, strict Zod validation, body size limits, and IP-based throttling.

## 1. Refresh Token Rotation 🔄

### Implementation: `lib/auth/refresh-tokens.ts` (Enhanced)

**What it does:**
- Automatically rotates refresh tokens on each use
- Prevents token replay attacks
- Detects suspicious activity patterns
- Immediately invalidates old tokens

**Key features:**
```typescript
// Enhanced rotateRefreshToken() function now:
1. Validates current token
2. Detects suspicious activity (multiple IPs, rapid creation)
3. Updates last-used timestamp
4. Adds old token to blacklist
5. Revokes in database
6. Creates new token
7. Returns new access + refresh tokens
```

**Usage in `/api/auth/refresh`:**
- Old tokens cannot be reused (blacklisted)
- Suspicious patterns trigger full token revocation
- All user tokens revoked if security threat detected

**Suspicious Activity Detection:**
- ✓ 3+ different IPs in 24 hours = suspicious
- ✓ 10+ tokens created in 24 hours = suspicious
- ✓ Automatic session termination on detection

---

## 2. Refresh Token Blacklist (Redis-Ready) 🚫

### Implementation: `lib/auth/token-blacklist.ts` (New)

**Architecture:**
```
TokenBlacklist
├── MemoryBlacklistStore (in-process cache)
│   ├── Fast O(1) lookups
│   ├── Auto-cleanup every 30 minutes
│   └── Single-instance deployment
└── RedisBlacklistStore (distributed cache)
    ├── Persistent across instances
    ├── TTL-based expiration
    └── Production ready
```

**Storage Modes:**
- **Development**: In-memory (MemoryBlacklistStore)
- **Production**: Redis + memory hybrid (RedisBlacklistStore)

**Key Methods:**
```typescript
// Initialize
const blacklist = getTokenBlacklist();

// Add token to blacklist
await blacklist.addToBlacklist(
  tokenId,
  userId,
  expiresAt,
  'logout' | 'rotation' | 'security' | 'compromised'
);

// Check if blacklisted
const isBlacklisted = await blacklist.isBlacklisted(tokenId);

// Get blacklist entry details
const entry = await blacklist.getBlacklistEntry(tokenId);
```

**Entry Structure:**
```typescript
interface BlacklistEntry {
  tokenId: string;          // JWT token ID
  userId: string;           // User who owned token
  revokedAt: number;        // Timestamp when revoked
  expiresAt: number;        // When entry expires in blacklist
  reason: string;           // logout|rotation|security|compromised
}
```

**Blacklist Cleanup:**
- Automatically removes expired entries
- Memory store cleanup: Every 30 minutes
- Redis TTL: Uses Redis native expiration
- No manual cleanup required

**Integration Points:**
- ✓ Token rotation adds to blacklist
- ✓ Logout adds to blacklist
- ✓ Refresh validation checks blacklist
- ✓ Security threats add all user tokens

---

## 3. Zod Strict Mode 🔒

### Implementation: Added `.strict()` to all schemas

**What `.strict()` does:**
```typescript
// BEFORE: Unknown properties allowed
const schema = z.object({ name: z.string() });
schema.parse({ name: "John", extra: "field" }); // ✓ Allowed

// AFTER: Unknown properties rejected
const schema = z.object({ name: z.string() }).strict();
schema.parse({ name: "John", extra: "field" }); // ✗ Throws error
```

**Updated Schemas:**
```
✓ /api/posts/route.ts
  - createPostSchema.strict()
  - listPostsSchema.strict()

✓ /api/posts/[id]/route.ts
  - updatePostSchema.strict()

✓ /api/cms/posts/route.ts
  - createPostSchema.strict()

✓ /api/cms/posts/[postId]/route.ts
  - updatePostSchema.strict()
  - All nested objects: post.strict(), seo.strict(), ui.strict()

✓ /api/posts/generate-slug/route.ts
  - schema.strict()

✓ /api/posts/validate-slug/route.ts
  - schema.strict()

✓ /api/cms/posts/generate-slug/route.ts
  - titleToSlugSchema.strict()

✓ /api/cms/posts/validate-slug/route.ts
  - slugValidationSchema.strict()

✓ /backend/src/middleware/validation.ts
  - All Zod schemas should use .strict()
```

**Benefits:**
- Prevents injection of unexpected fields
- Blocks API abuse vectors
- Ensures data integrity
- Fails fast on invalid input

**Example Error:**
```json
{
  "error": "Validation failed",
  "details": {
    "field": "root",
    "message": "Unrecognized key(s) in object: 'adminOverride'"
  }
}
```

---

## 4. Body Size Limits 📏

### Implementation: Middleware body size enforcement

**Frontend (Next.js): `middleware.ts`**
- All API routes: Body limit = 1 MB (default)
- Upload routes: Body limit = 50 MB
- Enforced via Next.js `express.json()` options

**Backend (Express): `backend/src/app.ts`**
```typescript
// Route-aware limits
app.use((req, res, next) => {
  const limit = req.path.startsWith('/api/upload') ? '50mb' : '1mb';
  return express.json({ limit })(req, res, next);
});

app.use((req, res, next) => {
  const limit = req.path.startsWith('/api/upload') ? '50mb' : '1mb';
  return express.urlencoded({ extended: true, limit })(req, res, next);
});
```

**Size Limits by Endpoint:**

| Endpoint Type | Size Limit | Purpose |
|---|---|---|
| API (general) | 1 MB | Prevents large payload attacks |
| Upload | 50 MB | Allows file uploads |
| Auth | 1 MB | Prevents password list attacks |
| CMS | 1 MB | Content must be reasonable size |
| Search | 1 MB | Prevents query DoS |

**409 Payload Too Large Response:**
```json
{
  "error": "Payload too large",
  "maxSize": "1 MB"
}
```

**Benefits:**
- ✓ Prevents DoS via large payloads
- ✓ Protects database from bloat
- ✓ Reduces memory usage
- ✓ Configurable per route type

---

## 5. IP-Based Throttling 🚦

### Implementation: `lib/security/ip-throttle.ts` (New)

**Architecture:**
```
IpThrottler (tracks per-IP metrics)
├── Auth Throttler (login, register, refresh)
├── Publish Throttler (create/update posts)
└── Search Throttler (full-text search)
```

**Rate Limits:**

### Auth Endpoint Throttling
```
Limit: 10 requests per 15 minutes per IP
Burst detection: 5 requests in <30 seconds
Block duration: 5 minutes (automatic)
```

**Protected Routes:**
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `POST /api/auth/password-reset`
- `GET /api/auth/google`

### Publish (CMS) Throttling
```
Limit: 30 requests per 60 seconds per IP
Burst detection: 10 requests in <10 seconds
Block duration: 5 minutes (automatic)
```

**Protected Routes:**
- `POST /api/cms/posts`
- `PUT /api/cms/posts/[id]`
- `PATCH /api/cms/posts/[id]`
- `DELETE /api/cms/posts/[id]`

### Search Throttling
```
Limit: 30 requests per 60 seconds per IP
Burst detection: 15 requests in <5 seconds
Block duration: 5 minutes (automatic)
```

**Protected Routes:**
- `GET /api/search`
- `POST /api/search`

**Implementation in Middleware:**
```typescript
// In middleware.ts - checked BEFORE rate limiting

// Auth throttle
if (pathname.startsWith('/api/auth/')) {
  const throttle = checkAuthThrottle(clientIp);
  if (!throttle.allowed) {
    return 429 Too Many Requests;
  }
}

// Publish throttle
if (pathname.startsWith('/api/cms/') && isWrite) {
  const throttle = checkPublishThrottle(clientIp);
  if (!throttle.allowed) {
    return 429 Too Many Requests;
  }
}

// Search throttle
if (pathname.startsWith('/api/search')) {
  const throttle = checkSearchThrottle(clientIp);
  if (!throttle.allowed) {
    return 429 Too Many Requests;
  }
}
```

**API Response (Throttled):**
```json
{
  "success": false,
  "error": "Too many authentication attempts from this IP...",
  "retryAfter": 847
}

Headers:
  Retry-After: 847
  429 Too Many Requests
```

**IP Extraction Logic:**
```typescript
// Priority order
1. Cloudflare IP (cf-connecting-ip)
2. X-Forwarded-For (first IP in list)
3. X-Real-IP (reverse proxy)
4. 'unknown' (fallback)
```

**Metrics Tracking:**
```typescript
interface IpMetrics {
  requestCount: number;       // Requests in current window
  lastRequestTime: number;    // Timestamp of last request
  blockedUntil?: number;      // When block expires
  suspicious: boolean;        // Detected suspicious activity
}

// Get metrics
const metrics = getThrottleMetrics(ip, 'auth');

// Manual block (security team triggered)
blockIpAddress(ip, 'auth', 30 * 60 * 1000); // Block for 30 min
```

**Automatic Cleanup:**
- Old entries cleaned every 60 minutes
- Entries aged >24 hours removed (if not blocked)
- Memory efficient: ~100 bytes per IP tracked

---

## Security Matrix

| Feature | Layer | Impact | Status |
|---|---|---|---|
| Refresh Token Rotation | Auth | Prevents replay attacks | ✅ |
| Token Blacklist | Auth | Invalidates old tokens | ✅ |
| Suspicious Activity Detection | Auth | Alerts on threat | ✅ |
| Zod Strict Mode | API | Blocks injection | ✅ |
| Body Size Limits | API | DoS prevention | ✅ |
| Auth IP Throttling | IP | Brute force protection | ✅ |
| Publish IP Throttling | IP | Content spam prevention | ✅ |
| Search IP Throttling | IP | Query DoS prevention | ✅ |

---

## Configuration

### Environment Variables

```bash
# Redis (for distributed token blacklist)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_password

# Kept in rate-limit.ts preset configs
# Adjust if needed in lib/security/rate-limit.ts
```

### Customization

**Adjust auth throttle limits:**
```typescript
// lib/security/ip-throttle.ts
export function checkAuthThrottle(ip: string) {
  return throttler.checkThrottle(
    ip,
    15,              // Change max requests
    20 * 60 * 1000,  // Change window duration
    8                // Change burst threshold
  );
}
```

**Adjust body size limits:**
```typescript
// middleware.ts or backend/src/app.ts
const limit = req.path.startsWith('/api/upload') ? '100mb' : '2mb';
```

**Change blacklist behavior:**
```typescript
// lib/auth/token-blacklist.ts
// Toggle Redis vs. Memory
const blacklist = new TokenBlacklist(useRedis: boolean);
```

---

## Testing

### Unit Tests to Add

```typescript
// Test refresh token rotation
test('rotateRefreshToken invalidates old token', async () => {
  // Old token should be blacklisted
  // New token should be valid
});

// Test blacklist
test('blacklisted token is rejected', async () => {
  // Add to blacklist
  // Verify isBlacklisted returns true
});

// Test suspicious activity
test('suspicious activity revokes all tokens', async () => {
  // Rapid requests from different IPs
  // All user tokens should be revoked
});

// Test Zod strict mode
test('strict schema rejects unknown fields', () => {
  const result = schema.safeParse({ name: 'John', extra: 'field' });
  expect(result.success).toBe(false);
});

// Test IP throttling
test('auth throttle blocks after 10 requests', () => {
  for (let i = 0; i < 10; i++) {
    checkAuthThrottle(ip); // allowed
  }
  expect(checkAuthThrottle(ip).allowed).toBe(false);
});
```

### Manual Testing

**Refresh Token Rotation:**
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Use refresh token to get new tokens
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json"

# Try to use old refresh token (should fail)
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"OLD_TOKEN"}'
# Expected: 401 Unauthorized
```

**IP Throttling:**
```bash
# Trigger auth throttle (11 requests in 15 min)
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"invalid@example.com","password":"wrong"}'
  sleep 1
done
# Expected 11th: 429 Too Many Requests
```

**Body Size Validation:**
```bash
# Create payload > 1MB
dd if=/dev/zero bs=1M count=2 | base64 > large_payload.txt

# Try to send (should fail)
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d @large_payload.txt
# Expected: 413 Payload Too Large (or similar)
```

---

## Monitoring & Alerting

### Metrics to Track

**Token Blacklist:**
- Blacklist size (memory usage)
- Token eviction rate
- Redis connection health

**IP Throttling:**
- Most throttled IPs
- Throttle block duration / frequency
- Burst detection triggers

**Security Events:**
- Failed refresh attempts
- Suspicious activity detections
- Manual IP blocks

### Recommended Alerts

1. **Blacklist size > 100K entries** - Check for leaks
2. **IP throttled > 10 times in 1 hour** - Possible attack
3. **Suspicious activity detected** - Review security logs
4. **Redis connection lost** - Fallback to memory store

---

## Deployment Checklist

- [ ] Add `lib/auth/token-blacklist.ts` file
- [ ] Update `lib/auth/refresh-tokens.ts` with rotation logic
- [ ] Create `lib/security/ip-throttle.ts` file
- [ ] Update `middleware.ts` with IP throttling checks
- [ ] Update `backend/src/app.ts` with body size limits
- [ ] Add `.strict()` to all Zod schemas
- [ ] Set `REDIS_URL` in production (optional)
- [ ] Test refresh token rotation
- [ ] Test IP throttle limits
- [ ] Test body size enforcement
- [ ] Monitor blacklist and throttle metrics
- [ ] Document custom configuration changes

---

## References

- [Zod strict mode](https://zod.dev/?id=strict-mode)
- [Express body-parser limits](https://expressjs.com/en/resources/middleware/body-parser.html)
- [Redis TTL](https://redis.io/commands/expire)
- [OAuth/JWT security](https://tools.ietf.org/html/rfc6749)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/API_Security_Cheat_Sheet.html#rate-limiting)

