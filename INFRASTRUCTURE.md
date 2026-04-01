# 🚀 Infrastructure Quick Start

This guide will get your production infrastructure running in ~30 minutes.

## Prerequisites
- Node.js 18+ and npm
- Git
- Accounts: Vercel, Neon, Cloudinary, Cloudflare (all have free tiers)

## 🎯 One-Command Setup
```bash
# Clone, install, and run setup script
git clone <repository>
cd the-corporate-blog
node scripts/setup-infrastructure.js
```

## 🔧 Manual Setup (if needed)

### 1. Database (Neon PostgreSQL)
```bash
# 1. Visit: https://console.neon.tech
# 2. Create project: "the-corporate-blog"  
# 3. Copy connection strings:
#    - POSTGRES_PRISMA_URL (with pgbouncer)
#    - POSTGRES_URL_NON_POOLING (direct)

# 4. Initialize database
npm run db:push
```

### 2. Environment Variables
```bash
# Copy and fill environment variables
cp .env.example .env.local

# Generate secure secrets
node scripts/manage-secrets.js generate

# Validate configuration
node scripts/manage-secrets.js validate
```

### 3. Cloudinary Media Storage
```bash
# 1. Visit: https://cloudinary.com/console
# 2. Get: Cloud Name, API Key, API Secret
# 3. Create upload presets:
node scripts/manage-secrets.js cloudinary
```

### 4. Vercel Deployment
```bash
# Install and deploy
npm install -g vercel
vercel login
vercel --prod

# Set environment variables
node scripts/manage-secrets.js vercel
```

### 5. Cloudflare DNS & CDN
```bash
# 1. Add domain to Cloudflare
# 2. Update nameservers
# 3. DNS Records:
#    @ CNAME cname.vercel-dns.com (Proxied ✅)
#    www CNAME cname.vercel-dns.com (Proxied ✅)

# See: docs/cloudflare-config.md for full setup
```

## ✅ Verification Checklist
```bash
# Test locally
npm run dev           # Should start without errors
npm run type-check    # Should pass
npm run lint          # Should pass
npm run build         # Should build successfully

# Test production
curl -I https://yourdomain.com                    # Should return 200
curl -I https://yourdomain.com/api/health         # Should return health status
```

## 🔐 Security Validation
```bash
# Run security checklist
node scripts/manage-secrets.js security

# Test SSL and headers
curl -I https://yourdomain.com

# Verify environment
node scripts/manage-secrets.js check
```

## 📊 Performance Testing
```bash
# Lighthouse CI
npx @lhci/cli@0.12.x autorun

# Or visit:
# - https://pagespeed.web.dev
# - https://gtmetrix.com  
# - https://webpagetest.org
```

## 🆘 Troubleshooting

### Common Issues
```bash
# Database connection failed
npx prisma db push --preview-feature

# Build errors
npm run type-check
npm run lint:fix

# Environment variables
node scripts/manage-secrets.js validate

# Deployment logs
vercel logs <deployment-url>
```

### Support Resources
- 📖 [Full deployment guide](DEPLOYMENT.md)
- 🌐 [Cloudflare configuration](docs/cloudflare-config.md)
- 🔧 [Vercel configuration](vercel.json)
- 🗄️ [Database schema](prisma/schema.prisma)

## 📈 Production Monitoring

### Analytics Dashboard
- **Vercel Analytics**: Automatic Core Web Vitals
- **Cloudflare Analytics**: CDN performance & security
- **Neon Console**: Database performance metrics

### Alerts Setup
```bash
# Set up monitoring in:
# - Vercel: Functions & Core Web Vitals
# - Cloudflare: Security events & downtime  
# - Neon: Connection pooling & query performance
```

---

## 🎉 You're Live!

Your blog is now running on production-grade infrastructure:
- ⚡ **Edge-optimized**: Cloudflare CDN + Vercel Edge Functions
- 🗄️ **Serverless database**: Neon PostgreSQL with connection pooling  
- 📸 **Image optimization**: Cloudinary with auto-format/quality
- 🔒 **Security hardened**: CSP headers, HTTPS, rate limiting
- 📊 **Analytics ready**: Core Web Vitals tracking
- 🚀 **Scalable**: Handles 1M+ DAU out of the box

**Next Steps**: Configure content, customize design, add team members!

---

*Need help? Check [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions or open an issue.*