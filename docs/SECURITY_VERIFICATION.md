# Security Hardening - Implementation Verification Checklist

## Phase 1: File Verification ✓

### New Files Created
- [x] `lib/auth/token-blacklist.ts` (220+ lines)
  - Dual-store architecture (Memory + Redis)
  - Auto-cleanup logic
  - All required methods implemented

- [x] `lib/security/ip-throttle.ts` (300+ lines)
  - Three specialized throttlers
  - Burst detection logic
  - IP extraction utilities

### Modified Files
- [x] `lib/auth/refresh-tokens.ts`
  - Token blacklist import added
  - `rotateRefreshToken()` enhanced with blacklist
  - Suspicious activity detection implemented

- [x] `middleware.ts`
  - IP throttle functions imported
  - Auth throttle gate added
  - Publish throttle gate added
  - Search throttle gate added

- [x] `backend/src/app.ts`
  - Body size limits made dynamic
  - 1MB for API routes
  - 50MB for upload routes

- [x] 10+ API routes with Zod schemas
  - `.strict()` added to all schemas
  - Nested objects marked strict
  - See SCHEMA_UPDATES.md for complete list

---

## Phase 2: Code Quality Checks

### TypeScript Compilation
```bash
# Run in project root
tsc --noEmit

# Expected: 0 errors
```

- [ ] No TypeScript errors
- [ ] No unused imports
- [ ] All types properly exported

### Linting
```bash
# If ESLint configured
npm run lint

# Expected: 0 critical warnings
```

- [ ] No linting errors
- [ ] Imports properly structured
- [ ] Code style consistent

---

## Phase 3: Functional Testing

### 3.1 Refresh Token Rotation

**Setup:**
```bash
# Start your development server
npm run dev
```

**Test Case: Token blacklist prevents reuse**
```bash
# 1. Get initial tokens
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -c cookies.txt

# Response should have:
# - accessToken
# - refreshToken

# 2. Rotate token (get new pair)
REFRESH_TOKEN="[token from step 1]"
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -H "Cookie: refreshToken=$REFRESH_TOKEN" \
  -c cookies.txt

# Response should have:
# - NEW accessToken (different from step 1)
# - NEW refreshToken (different from step 1)

# 3. Try to reuse OLD refresh token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"

# Expected Response:
# 401 Unauthorized
# "Token has been revoked or blacklisted"
```

**Verification:**
- [ ] New tokens different from old tokens
- [ ] Old token rejected after rotation
- [ ] Error message indicates blacklist/revocation
- [ ] No silent failures

---

### 3.2 Suspicious Activity Detection

**Test Case: Multiple IPs trigger security lock**
```bash
# Simulate same user, different IPs (use proxy or VPN)

# From IP 1
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 192.168.1.1" \
  -d '{"email":"test@example.com","password":"password"}' | jq -r '.refreshToken')

# From IP 2
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 192.168.1.2" \
  -d "{\"refreshToken\":\"$TOKEN\"}"

# From IP 3+ (rapid succession) - on 3rd IP
# Expected at some point: Security alert triggered
# All user tokens revoked
```

**Verification:**
- [ ] Detected 3+ IPs
- [ ] All tokens revoked (not just current)
- [ ] User logs show suspicious activity
- [ ] Error appropriately indicates security issue

---

### 3.3 Zod Strict Mode Validation

**Test Case: Extra fields rejected**
```bash
# Create post with unknown field
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Post",
    "content": "Content here",
    "adminBypass": "malicious"
  }'

# Expected Response:
# 400 Bad Request
# {
#   "error": "Validation failed",
#   "details": {
#     "message": "Unrecognized key(s) in object: 'adminBypass'"
#   }
# }
```

**Verification:**
- [ ] Unknown fields rejected
- [ ] Error message clear
- [ ] Status code 400
- [ ] No silent acceptance

**Test Case: Nested objects also strict**
```bash
curl -X POST http://localhost:3000/api/cms/posts \
  -H "Content-Type: application/json" \
  -d '{
    "post": {
      "title": "Test",
      "content": "Content",
      "backdoor": "field"
    }
  }'

# Expected: 400 Bad Request (backdoor rejected)
```

**Verification:**
- [ ] Nested objects reject unknown fields
- [ ] Works for all nested levels
- [ ] Prevents injection attacks

---

### 3.4 Body Size Limits

**Test Case: 1MB limit on API routes**
```bash
# Create 2MB payload
dd if=/dev/zero bs=1M count=2 2>/dev/null | base64 > large.txt

# Try to POST
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d @large.txt

# Expected Response:
# 413 Payload Too Large
# or similar error from Express body-parser
```

**Verification:**
- [ ] 1MB limit enforced
- [ ] Clear error message
- [ ] HTTP 413 status code

**Test Case: 50MB limit on upload routes**
```bash
# Create 45MB payload (should succeed)
dd if=/dev/zero bs=1M count=45 2>/dev/null | base64 > large.txt

curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d @large.txt

# Expected: Success (or expected upload response)
```

**Verification:**
- [ ] 50MB allowed for uploads
- [ ] Works separately from API limits
- [ ] Distinguishes upload vs API routes

---

### 3.5 IP-Based Throttling

**Test Case: Auth endpoint throttle**
```bash
# Make 11 requests rapidly (limit is 10 per 15 min)
for i in {1..11}; do
  echo "Request $i..."
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test$i@example.com\",\"password\":\"wrong\"}" \
    -w "\nStatus: %{http_code}\n"
  sleep 0.5
done

# Expected:
# Requests 1-10: 200 or 401 (processing)
# Request 11: 429 Too Many Requests
```

**Verification:**
- [ ] 10 requests allowed
- [ ] 11th request returns 429
- [ ] Error message indicates rate limit
- [ ] Retry-After header present

```bash
# Verify header
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}' \
  -i | grep -i "retry-after"

# Should see:
# Retry-After: [seconds]
```

**Test Case: Burst detection (5 in <30 sec)**
```bash
# Send 6 rapid requests (<30 sec)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -w "Status: %{http_code}\n"
done

# Expected:
# Before 30s mark, 6th request may trigger burst block
# or if under burst window, may be 429
```

**Verification:**
- [ ] Burst detection working
- [ ] Faster block on burst (vs normal throttle)
- [ ] Block duration ~5 minutes

**Test Case: Publish endpoint throttle**
```bash
# Make 31 requests to CMS post endpoint
for i in {1..31}; do
  curl -X POST http://localhost:3000/api/cms/posts \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"post":{"title":"Test"}}'
  sleep 0.5
done

# Expected: Request 31+ returns 429
```

**Verification:**
- [ ] 30 requests allowed per minute
- [ ] 31st returns 429
- [ ] Different from auth throttle limits

**Test Case: Search endpoint throttle**
```bash
# Make 31 requests to search
for i in {1..31}; do
  curl -X GET 'http://localhost:3000/api/search?q=test' \
    -w "Status: %{http_code}\n"
  sleep 0.5
done

# Expected: Request 31+ returns 429
```

**Verification:**
- [ ] Search throttle enforced
- [ ] Separate from publish throttle
- [ ] Prevents search spam

**Test Case: IP extraction (headers)**
```bash
# Test CloudFlare header
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "CF-Connecting-IP: 203.0.113.1" \
  -d '{"email":"test@example.com","password":"wrong"}'

# Test X-Forwarded-For
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 198.51.100.1, 203.0.113.2" \
  -d '{"email":"test@example.com","password":"wrong"}'

# Test X-Real-IP (fallback)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Real-IP: 192.0.2.1" \
  -d '{"email":"test@example.com","password":"wrong"}'
```

**Verification:**
- [ ] Handles CF-Connecting-IP
- [ ] Handles X-Forwarded-For
- [ ] Handles X-Real-IP
- [ ] Falls back gracefully

---

## Phase 4: Integration Testing

### 4.1 Middleware Order

**Test Case: IP throttle runs before rate limit**

```typescript
// Add logging to verify order in middleware.ts
console.log('[1] Checking IP throttle...');
const ipThrottle = checkAuthThrottle(ip);
console.log('[2] Checking rate limit...');
// etc.
```

**Verification:**
- [ ] IP throttle logged first
- [ ] IP throttle blocks before rate limit
- [ ] No double-counting

### 4.2 Token Rotation + Thumbnail + Blacklist

**Full flow test:**
```bash
# 1. Login (get tokens)
LOGIN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}')

TOKEN=$(echo $LOGIN | jq -r '.refreshToken')

# 2. Rotate token (new pair issued)
ROTATION=$(curl -s -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$TOKEN\"}")

NEW_TOKEN=$(echo $ROTATION | jq -r '.refreshToken')

# 3. Verify old token invalid
REUSE=$(curl -s -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$TOKEN\"}")

ERROR=$(echo $REUSE | jq -r '.error')

if [[ "$ERROR" == *"revoked"* ]]; then
  echo "✓ Token blacklist working"
else
  echo "✗ Token blacklist NOT working"
fi
```

**Verification:**
- [ ] Login succeeds
- [ ] Rotation succeeds with new tokens
- [ ] Old token rejected

---

## Phase 5: Security Audit

### 5.1 Vulnerability Checks

- [ ] No hardcoded secrets in code
- [ ] No sensitive data in error messages
- [ ] Redis password protected (if used)
- [ ] Blacklist TTL properly configured
- [ ] No SQL injection via strict validation

### 5.2 Performance Checks

```bash
# Measure auth endpoint response time
time curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Should be < 50ms (blacklist check is O(1))
```

**Verification:**
- [ ] Blacklist check doesn't slow down auth
- [ ] IP throttle O(1) lookups
- [ ] Memory usage reasonable

### 5.3 Database Checks

```sql
-- Verify refresh token indexes
SELECT * FROM pg_indexes 
WHERE tablename = 'refresh_tokens'
AND indexname LIKE '%user%'
OR indexname LIKE '%token%'
OR indexname LIKE '%expires%';

-- Should have indexes on:
-- - userId
-- - tokenId  
-- - expiresAt
```

**Verification:**
- [ ] Indexes exist for performance
- [ ] No N+1 queries in rotation
- [ ] Token cleanup working

---

## Phase 6: Documentation Checks

- [ ] API documentation updated with 429 responses
- [ ] Rate limits documented per endpoint
- [ ] Body size limits documented
- [ ] Blacklist architecture explained
- [ ] Security section added to README

---

## Phase 7: Deployment Readiness

### Environment Setup
```bash
# .env or .env.production

# Optional (memory fallback used if missing)
REDIS_URL=redis://localhost:6379
```

- [ ] REDIS_URL set (if using Redis)
- [ ] No hardcoded values in code
- [ ] Error handling for Redis unavailable

### Dependencies
- [ ] All imports resolved
- [ ] No missing packages
- [ ] package.json up to date

### Build Test
```bash
# Test full build
npm run build

# Expected: 0 errors
```

- [ ] Build succeeds
- [ ] No warnings about missing types
- [ ] Output files correct

---

## Phase 8: Production Deployments

### Pre-deployment
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Security audit completed
- [ ] Database migrated (if schema changed)

### Deployment
- [ ] Feature flagged (if possible)
- [ ] Gradual rollout started
- [ ] Monitoring dashboards created
- [ ] Alert thresholds configured

### Post-deployment
- [ ] Monitor error rates
- [ ] Check blacklist size growth
- [ ] Verify throttle effectiveness
- [ ] User reports collected

---

## Common Issues & Troubleshooting

### Issue: "Module not found: lib/auth/token-blacklist"
**Solution:** Verify file exists at `lib/auth/token-blacklist.ts`
```bash
ls -la lib/auth/token-blacklist.ts
```

### Issue: Redis connection timeout
**Solution:** Blacklist falls back to memory. Check Redis status:
```bash
redis-cli ping
# Should respond: PONG
```

### Issue: "Unrecognized key(s)" error on all requests
**Solution:** Verify `.strict()` added correctly. Check other fields are valid:
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Content"}'
# Should work if those are valid fields
```

### Issue: IP throttling not working
**Solution:** Check middleware.ts imports and execution order:
```bash
grep -n "checkAuthThrottle" middleware.ts
# Should appear before "rateLimitMiddleware"
```

---

## Sign-off

- [ ] All phases completed
- [ ] All tests passing
- [ ] Security audit passed
- [ ] Ready for production

**Date Completed:** ___________
**Reviewed By:** ___________
**Deployed Date:** ___________

