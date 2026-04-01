# Source Map Security - Implementation Checklist

## Summary of Changes

All critical source map security issues have been **identified and fixed**:

### ✅ Changes Applied

#### 1. **Next.js Configuration** (`next.config.js`) 
- [x] Added `productionBrowserSourceMaps: false` - disables frontend source maps in production
- [x] Wrapped with `withSentryConfig()` - enables proper Sentry integration for error tracking
- [x] Added source map blocking headers - prevents access to `.map` files
- [x] Added Sentry release tracking for proper error attribution

#### 2. **Backend TypeScript Config** (`backend/tsconfig.json`)
- [x] Changed `sourceMap: true` → `sourceMap: false` - prevents backend source maps in production
- [x] Set `declarationMap: false` - no declaration maps generated
- [x] Removed `sourcemap` from production builds

#### 3. **Production Build Config** (`backend/tsconfig.prod.json`)
- [x] Created production-specific TypeScript config
- [x] Ensures no source maps in production deployments
- [x] Can be used with `tsc -p tsconfig.prod.json` for clean builds

#### 4. **Production Environment Template** (`.env.production.example`)
- [x] Enhanced with Sentry configuration options
- [x] Added JWT and authentication secrets placeholders
- [x] Included security-related environment variables
- [x] Documented importance of NOT committing this file
- [x] Added comprehensive notes about secret management

#### 5. **Build Security Verification** (`scripts/verify-build-security.js`)
- [x] Created automated security check script
- [x] Detects exposed source map files
- [x] Detects hardcoded secrets in source code
- [x] Validates configuration files
- [x] Generates security report with severity levels

#### 6. **Package.json Build Scripts**
- [x] Updated `build` script to run security verification
- [x] Added `build:prod` for production builds with verification
- [x] Added `verify:security` script to package.json

#### 7. **.gitignore Updates**
- [x] Added all source map file patterns (`*.map`, `*.js.map`, etc.)
- [x] Added `.sentry/` and `.sentryclirc` entries
- [x] Added `.env.production` and other secret files
- [x] Organized entries by category for clarity

---

## Verification Steps

### Step 1: Verify Configuration Files
```bash
# Check next.config.js has productionBrowserSourceMaps: false
grep -n "productionBrowserSourceMaps" next.config.js
# Expected: Found at line 4-5

# Check withSentryConfig is used
grep -n "withSentryConfig" next.config.js
# Expected: Used in module.exports

# Check backend tsconfig
grep -n '"sourceMap"' backend/tsconfig.json
# Expected: "sourceMap": false
```

### Step 2: Test Build Security Script
```bash
# Run the security verification script
npm run verify:security

# Expected output:
# ✅ All security checks passed!
# (or lists any issues to fix)
```

### Step 3: Build and Verify No Maps
```bash
# Build for production
npm run build:prod

# Check for source map files in output
find .next -name "*.map" | wc -l
# Expected: 0

find dist -name "*.map" | wc -l  
# Expected: 0
```

### Step 4: Validate Environment Configuration
```bash
# Verify .env.production is in .gitignore
grep ".env.production" .gitignore
# Expected: Found and uncommented

# Verify no .env files are committed
git status | grep ".env"
# Expected: No matches (already in gitignore)
```

### Step 5: Check Sentry Configuration
```bash
# Verify Sentry import exists
grep -n "withSentryConfig" next.config.js

# Verify environment variables documented
grep -n "SENTRY_" .env.production.example
# Expected: SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
```

---

## Pre-Deployment Checklist

### Configuration Files Ready
- [x] `next.config.js` - productionBrowserSourceMaps disabled + withSentryConfig applied
- [x] `backend/tsconfig.json` - sourceMap disabled
- [x] `backend/tsconfig.prod.json` - created with strict prod settings
- [x] `.gitignore` - all maps and secrets excluded

### Build Process Configured
- [x] `npm run build` includes security verification
- [x] `npm run build:prod` available for production
- [x] `npm run verify:security` script exists
- [x] `npx next build` will now validate security

### Environment & Secrets
- [x] `.env.production.example` created with all variables
- [x] `.env.production` is gitignored
- [x] Sentry tokens documented in example
- [x] Instructions to store secrets in platform (Vercel, Railway, etc.)

### Production Deployment Ready
- [x] No source maps will be generated in production
- [x] Source maps blocked via HTTP headers
- [x] Errors tracked via Sentry (requires SENTRY_DSN)
- [x] Security verification runs on each build

---

## Secrets Management Guide

### For Local Development
1. Copy `.env.production.example` → `.env.local`
2. Fill in actual development values
3. Keep `.env.local` out of git (already in .gitignore)

### For Production Deployment (Vercel)
1. Go to Project Settings → Environment Variables
2. Add all variables from `.env.production.example`
3. **DO NOT** create `.env.production` file
4. Vercel will inject these at build time

### For Other Platforms (Railway, Render, etc.)
1. Go to Secrets/Environment management
2. Add all required variables
3. Deploy normally (build scripts will use them)

### Sentry Configuration
1. Create account at https://sentry.io
2. Create project (e.g., "The Corporate Blog")
3. Note: **org slug**, **project slug**, **auth token**
4. Add to environment variables:
   ```
   SENTRY_ORG=your-org
   SENTRY_PROJECT=your-project
   SENTRY_AUTH_TOKEN=your-token (keep secret!)
   SENTRY_DSN=https://...  (public, for error reporting)
   NEXT_PUBLIC_SENTRY_DSN=https://...  (public, for frontend)
   ```

---

## Security Vulnerabilities Addressed

| Vulnerability | Issue | Fix | Status |
|---|---|---|---|
| Source Maps in Production | Frontend `.map` files exposing code | `productionBrowserSourceMaps: false` | ✅ |
| Backend Maps Exposed | TypeScript source maps exposed | `sourceMap: false` in tsconfig | ✅ |
| Missing Sentry Config | Error tracking not working | `withSentryConfig()` applied | ✅ |
| HTTP Access to Maps | Maps downloadable from HTTP | Headers blocking `.map` access | ✅ |
| Hardcoded Secrets | Credentials in source code | Script detecting hardcoded secrets | ✅ |
| Exposed Env Files | `.env.production` committed to git | Added to .gitignore + verification | ✅ |

---

## Testing Security Post-Deployment

### Test 1: Verify Maps Not Accessible
```bash
# Production domain example
curl -I https://yourdomain.com/_next/static/chunks/main.js.map

# Expected: 404 Not Found or 403 Forbidden
# Should NOT return 200 with the map file
```

### Test 2: Check Sentry Dashboard
```
1. Log into Sentry (https://sentry.io)
2. Go to Project → Source Maps
3. Should see maps uploaded by build
4. Should NOT see maps in public CDN
```

### Test 3: Trigger Error and Verify Source Map Handling
```javascript
// In .env.production, ensure:
// NEXT_PUBLIC_SENTRY_DSN=your-production-dsn

// Trigger an error in production
throw new Error('Test error for Sentry');

// Check Sentry dashboard:
// - Error should appear with proper source location
// - Should reference original source, not minified code
// - No sensitive data leaked in stack trace
```

### Test 4: Run Build Security Check
```bash
npm run verify:security

# Should pass all checks
# If fails, review output for specific issues
```

---

## Monitoring & Maintenance

### Weekly
- [ ] Check Sentry dashboard for errors
- [ ] Monitor for unusual error patterns
- [ ] Verify no secrets exposed in error messages

### Monthly
- [ ] Review Sentry source maps usage
- [ ] Prune old source maps from Sentry (>30 days)
- [ ] Rotate SENTRY_AUTH_TOKEN if needed
- [ ] Audit .env.production access logs

### Before Each Deploy
- [ ] Run `npm run verify:security`
- [ ] Confirm build passes all checks
- [ ] Verify no `.map` files in build output
- [ ] Double-check environment variables in platform

---

## Troubleshooting

### Issue: "productionBrowserSourceMaps not working"
**Solution:** Ensure you're NOT using an older Next.js cache
```bash
rm -rf .next
npm run build:prod
```

### Issue: "Sentry maps not uploading"
**Solution:** Check Sentry auth token and org/project settings
```bash
# Verify token works
npx sentry-cli --auth-token $SENTRY_AUTH_TOKEN releases list

# Should list recent releases
```

### Issue: "Map files still appearing in output"
**Solution:** Check if webpack is being customized
```bash
# Search for webpack config
grep -r "sourceMap.*true" . --include="*.js" --include="*.ts"

# Should find nothing
```

### Issue: "Build verification script failing"
**Solution:** Run with debug output
```bash
node scripts/verify-build-security.js

# Review output for specific issues
# Most common: source maps found or env files exposed
```

---

## References & Documentation

- [Sentry Documentation](https://docs.sentry.io/)
- [Next.js Security Best Practices](https://nextjs.org/docs/advanced-features/security-headers)
- [OWASP Information Disclosure](https://owasp.org/www-project-top-ten/)
- [TypeScript SourceMap Options](https://www.typescriptlang.org/tsconfig#sourceMap)

---

## Sign-Off

| Role | Date | Status |
|------|------|--------|
| Implemented | | ✅ Complete |
| Tested | | ⏳ Pending |
| Deployed | | ⏳ Pending |
| Verified | | ⏳ Pending |

---

**Implementation Date:** March 20, 2026  
**Version:** 1.0  
**Status:** Ready for Testing

