# Source Map Security Validation & Remediation

## 🚨 Critical Issues Found

### Issue 1: Sentry Integration Not Applied to Next.js Config
**Severity:** 🔴 Critical  
**Location:** `next.config.js` line 1, line 117  
**Problem:**
```javascript
// IMPORTED but NEVER USED
const { withSentryConfig } = require('@sentry/nextjs');

// Line 117 - Missing Sentry wrapper!
module.exports = withBundleAnalyzer(nextConfig);
// Should be:
// module.exports = withSentryConfig(withBundleAnalyzer(nextConfig), { ...options });
```

**Impact:**
- Source maps are NOT being handled by Sentry's security protocol
- Sentry DSN configuration is ignored
- Source maps are publicly accessible by default in Next.js production builds
- Secrets could leak in source maps if exposed

---

### Issue 2: Backend TypeScript Source Maps Enabled Without Production Override
**Severity:** 🔴 Critical  
**Location:** `backend/tsconfig.json` line 32  
**Problem:**
```json
{
  "compilerOptions": {
    "sourceMap": true  // ← Enabled for ALL builds including production
  }
}
```

**Impact:**
- Backend source maps generated for all Node.js/Express routes
- Maps expose internal code structure and potential secrets
- No distinction between dev/prod builds

---

### Issue 3: No Source Map Exclusion in Next.js Config
**Severity:** 🔴 Critical  
**Location:** `next.config.js`  
**Problem:**
- No `productionBrowserSourceMaps: false` configuration
- Next.js default allows source maps in production
- Not using Sentry's source map upload/stripping feature

---

### Issue 4: Missing Environment-Specific Build Configuration
**Severity:** 🟠 High  
**Location:** `.env.production` (missing)  
**Problem:**
- No `.env.production` file to control build behavior
- Can't differentiate build settings between dev/prod
- Source map behavior not controlled by environment

---

### Issue 5: Potential Secrets Exposure in Source Maps
**Severity:** 🟠 High  
**Location:** Environment variables throughout codebase  
**Evidence:**
```javascript
// These could appear in source maps if not stripped:
- JWT_SECRET
- REFRESH_SECRET
- GOOGLE_CLIENT_SECRET
- CLOUDINARY_API_SECRET
- SENTRY_DSN
- API Keys and tokens
```

---

## ✅ Validation Checks

### Check 1: TSConfig Source Maps
```bash
# CURRENT (VULNERABLE):
grep -n "sourceMap" backend/tsconfig.json
# Result: "sourceMap": true (no condition)

# SHOULD BE:
# No sourceMap: true in production builds
# OR conditional: sourceMap: process.env.NODE_ENV === 'production' ? false : true
```

### Check 2: Next.js Config Wrapper Order
```bash
# CURRENT (BROKEN):
grep -A2 "module.exports" next.config.js
# Result: module.exports = withBundleAnalyzer(nextConfig);

# SHOULD BE:
# module.exports = withSentryConfig(
#   withBundleAnalyzer(nextConfig),
#   { ... }
# );
```

### Check 3: Vercel/Production Configuration
```bash
# CHECK: vercel.json NODE_ENV setting
grep -n "NODE_ENV" vercel.json
# Result: "NODE_ENV": "production" (but this doesn't control Next.js sourcemaps)
```

### Check 4: Source Map Files Generated
```bash
# RISK: These files would be exposed if published
.next/**/*.js.map      # Frontend source maps (DANGEROUS)
dist/**/*.js.map       # Backend source maps (DANGEROUS)
build/**/*.js.map      # Build output source maps
```

---

## 🔧 Required Fixes

### Fix 1: Update next.config.js with Sentry Config

**File:** `next.config.js`

```javascript
// BEFORE
const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  // ... config
};

module.exports = withBundleAnalyzer(nextConfig);

// AFTER
const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  // ... config
  productionBrowserSourceMaps: false, // ← Disable source maps in production
};

// Wrap with Sentry (should be OUTER wrapper for proper order)
module.exports = withSentryConfig(
  withBundleAnalyzer(nextConfig),
  {
    // Sentry configuration for source map handling
    silent: false, // Set to true if you want to suppress Sentry logs during build
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
  }
);
```

---

### Fix 2: Disable Backend Source Maps in Production

**File:** `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "sourceMap": false,  // ← Disabled by default
    // OR use conditional if keeping for dev:
    "sourceMap": true,
    "sourceMapIncludeContent": false,  // Don't inline source content
    "removeComments": true,
    "noUnusedLocals": true,
    "noImplicitAny": true
  }
}
```

**Alternative - Environment-based (Better for dev):**

Create `backend/tsconfig.prod.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "sourceMap": false,
    "declaration": true,
    "declarationMap": false,
    "removeComments": true
  }
}
```

Then update `backend/package.json`:
```json
{
  "scripts": {
    "build": "tsc -p tsconfig.prod.json",
    "dev": "ts-node src/server.ts"
  }
}
```

---

### Fix 3: Create .env.production with Build Controls

**File:** `.env.production`

```bash
# Production Environment Configuration
NODE_ENV=production

# Build-time source map control
NEXT_PUBLIC_DISABLE_SOURCE_MAPS=true  # Webpack plugin respects this
SENTRY_DSN="your-production-sentry-dsn"
NEXT_PUBLIC_SENTRY_DSN="your-production-sentry-dsn"

# Sentry upload configuration
SENTRY_ORG="your-org-slug"
SENTRY_PROJECT="your-project-slug"
SENTRY_AUTH_TOKEN="your-sentry-auth-token"  # Keep this secret!

# Database
DATABASE_URL="your-production-db-url"
POSTGRES_PRISMA_URL="your-production-db-url"
POSTGRES_URL_NON_POOLING="your-production-db-url"

# Authentication
JWT_SECRET="your-production-jwt-secret"
REFRESH_SECRET="your-production-refresh-secret"
NEXTAUTH_SECRET="your-production-nextauth-secret"

# Other production secrets...
```

**Update .gitignore** to ensure .env.production is NOT committed:
```bash
# Local env files
.env*.local
.env
.env.development
.env.production      # ← Add this line if not already there
.env.test
```

---

### Fix 4: Add Build-Time Security Headers

**Update next.config.js - Add to headers():**

```javascript
  async headers() {
    return [
      // ... existing headers
      
      // Prevent source map exposure
      {
        source: '/(.*).js.map',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      
      // Block access to source maps
      {
        source: '/_next/(.*).js.map',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  }
```

---

### Fix 5: Add .gitignore Entries for Source Map Files

**File:** `.gitignore` - Add these entries:

```bash
# Source maps (can expose internal code structure)
*.map
*.js.map
*.css.map
*.ts.map

# Next.js build outputs (including source maps)
.next/**/*.map
.next/static/**/*.map

# Backend build outputs
dist/**/*.map
build/**/*.map

# Sentry upload artifacts
.sentry/
.sentryclirc

# Environment secrets
.env.production
.env.*.local
.env.production.local
```

---

### Fix 6: Update Backend Build Process

**File:** `backend/package.json`

```json
{
  "scripts": {
    "build": "tsc --project tsconfig.prod.json --skipLibCheck",
    "build:dev": "tsc --skipLibCheck",
    "start": "node dist/server.js",
    "dev": "ts-node -r dotenv/config src/server.ts",
    "prebuild": "npm run clean",
    "clean": "rm -rf dist"
  }
}
```

**File:** Create `backend/tsconfig.prod.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": false,
    "sourceMap": false,
    "removeComments": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

---

### Fix 7: Add Production Build Verification Script

**File:** `scripts/verify-build-security.js`

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Production Build Security...\n');

const issues = [
  {
    name: 'Frontend Source Maps',
    check: () => {
      const mapFiles = [];
      const nextDir = '.next/static';
      
      if (fs.existsSync(nextDir)) {
        const walkDir = (dir) => {
          const files = fs.readdirSync(dir, { withFileTypes: true });
          files.forEach(file => {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
              walkDir(fullPath);
            } else if (file.name.endsWith('.js.map')) {
              mapFiles.push(fullPath);
            }
          });
        };
        walkDir(nextDir);
      }
      
      return mapFiles.length === 0 ? 
        '✅ No frontend source maps found' : 
        `❌ Found ${mapFiles.length} frontend source maps (SECURITY RISK): ${mapFiles.join(', ')}`;
    }
  },
  {
    name: 'Backend Source Maps',
    check: () => {
      const distDir = 'dist';
      const mapFiles = fs.existsSync(distDir) ? 
        fs.readdirSync(distDir, { recursive: true })
          .filter(f => f.endsWith('.map')) : [];
      
      return mapFiles.length === 0 ? 
        '✅ No backend source maps found' : 
        `❌ Found ${mapFiles.length} backend source maps (SECURITY RISK)`;
    }
  },
  {
    name: '.env.local Exposure',
    check: () => {
      const exposedEnv = ['.env.local', '.env.production.local'];
      const found = exposedEnv.filter(f => fs.existsSync(f));
      
      return found.length === 0 ? 
        '✅ No exposed environment files' : 
        `❌ Found exposed env files: ${found.join(', ')}`;
    }
  },
  {
    name: 'Secrets in Source',
    check: () => {
      const secretPatterns = [
        /JWT_SECRET/,
        /REFRESH_SECRET/,
        /CLIENT_SECRET/,
        /API_KEY/,
        /password/i
      ];
      
      // Check if any hardcoded secrets in src files
      const srcDir = 'src';
      let found = false;
      
      if (fs.existsSync(srcDir)) {
        const walk = (dir) => {
          try {
            fs.readdirSync(dir, { withFileTypes: true }).forEach(file => {
              if (file.isDirectory()) {
                walk(path.join(dir, file.name));
              } else if (file.name.endsWith('.ts') || file.name.endsWith('.js')) {
                const content = fs.readFileSync(path.join(dir, file.name), 'utf8');
                if (secretPatterns.some(p => p.test(content))) {
                  found = true;
                }
              }
            });
          } catch (e) {
            // Ignore permission errors
          }
        };
        walk(srcDir);
      }
      
      return found ? 
        '⚠️ Potential secrets found in source code' : 
        '✅ No obvious secrets in source code';
    }
  }
];

let passCount = 0;
let failCount = 0;

issues.forEach(({ name, check }) => {
  const result = check();
  console.log(`${name}:`);
  console.log(`  ${result}\n`);
  
  if (result.includes('✅')) passCount++;
  if (result.includes('❌')) failCount++;
});

console.log(`\n📊 Result: ${passCount} passed, ${failCount} failed\n`);

if (failCount > 0) {
  console.log('⚠️ Production build has security issues. Deploy with caution.');
  process.exit(1);
} else {
  console.log('✅ Production build passed security checks.');
  process.exit(0);
}
```

Add to `package.json`:
```json
{
  "scripts": {
    "verify:security": "node scripts/verify-build-security.js",
    "prebuild": "npm run verify:security"
  }
}
```

---

## 📋 Deployment Checklist

### Before Production Build

- [ ] **Update next.config.js**
  - [ ] Add `productionBrowserSourceMaps: false`
  - [ ] Wrap with `withSentryConfig()`
  - [ ] Add source map blocking headers

- [ ] **Update backend tsconfig**
  - [ ] Create `tsconfig.prod.json` with `sourceMap: false`
  - [ ] Update build script to use prod config
  - [ ] Test build output for .map files

- [ ] **Create .env.production**
  - [ ] Set all Sentry tokens
  - [ ] Set production database URL
  - [ ] Set all secrets as real production values
  - [ ] Verify .gitignore excludes it

- [ ] **Test Build Security**
  - [ ] Run build verification script
  - [ ] Check .next/ directory for .map files
  - [ ] Check dist/ directory for .map files
  - [ ] Scan for hardcoded secrets

- [ ] **Verify Sentry Upload**
  - [ ] Confirm SENTRY_ORG and SENTRY_PROJECT in .env.production
  - [ ] Test Sentry CLI can authenticate
  - [ ] Verify source maps upload to Sentry after build

---

## 🔐 Security Best Practices

### ✅ DO:
- [ ] Disable source maps for production browser code
- [ ] Use environment variables for all secrets
- [ ] Let Sentry handle source map uploads/management
- [ ] Add headers to block .map file access
- [ ] Verify build output before deployment
- [ ] Use `.env.production` (not committed to git)
- [ ] Review `productionBrowserSourceMaps` setting regularly

### ❌ DON'T:
- [ ] Include source maps in production bundles
- [ ] Upload source maps to public CDN
- [ ] Commit `.env.production` to repository
- [ ] Hardcode secrets in source code
- [ ] Use Sentry DSN tokens with upload permissions in frontend code
- [ ] Expose Sentry auth tokens in environment

---

## 🧪 Testing Source Map Security

### Test 1: Verify Maps Not in Build Output
```bash
# Build for production
npm run build

# Check for source maps (should be empty)
find .next -name "*.map" | wc -l
# Expected: 0

find dist -name "*.map" | wc -l
# Expected: 0
```

### Test 2: Check Headers Block Map Access
```bash
# After deploying
curl -I https://yourdomain.com/_next/static/chunks/main.js.map

# Expected: 404 or 403 with X-Content-Type-Options: nosniff
```

### Test 3: Verify Sentry Has Maps
```bash
# Login to Sentry dashboard
# Go to Project Settings > Source Maps
# Should see maps uploaded by build process
```

### Test 4: Scan for Exposed Secrets
```bash
# Install tool
npm install -g detect-secrets

# Scan codebase
detect-secrets scan --all-files

# Should find NO secrets in committed code
```

---

## 📝 Verification Results

**Date:** ___________  
**Build**: Production `npm run build`

- [ ] No source maps in `.next/static`
- [ ] No source maps in `dist/` 
- [ ] No exposed environment files
- [ ] No hardcoded secrets in source
- [ ] Sentry source maps uploaded successfully
- [ ] Headers prevent `.map` file access
- [ ] Build verification script passed

**Signed Off By:** ___________

---

## References

- [Sentry Source Maps Documentation](https://docs.sentry.io/platforms/javascript/sourcemaps/)
- [Next.js Security Best Practices](https://nextjs.org/docs/advanced-features/security-headers)
- [OWASP: Information Disclosure](https://owasp.org/www-project-top-ten/2021/A01_2021-Broken_Access_Control/)
- [Webpack Source Maps in Production](https://webpack.js.org/configuration/devtool/#source-maps)

