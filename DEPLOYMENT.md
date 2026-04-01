# =============================================================================
# The Corporate Blog - Deployment Guide
# =============================================================================

## 🚀 Infrastructure Setup

### 1. Neon PostgreSQL Database
1. Visit https://console.neon.tech
2. Create a new project: "the-corporate-blog"
3. Choose region: US East (Virginia) for best Vercel performance
4. Copy the connection strings:
   - `DATABASE_URL` (connection pooling)
   - `POSTGRES_PRISMA_URL` (with pgbouncer)
   - `POSTGRES_URL_NON_POOLING` (direct connection)

### 2. Vercel Deployment (Frontend + Backend)
1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`
4. Set environment variables in Vercel dashboard:
   ```bash
   # Database
   POSTGRES_PRISMA_URL="your-neon-connection-string"
   POSTGRES_URL_NON_POOLING="your-neon-direct-connection"
   
   # Authentication
   NEXTAUTH_SECRET="your-generated-secret"
   NEXTAUTH_URL="https://your-domain.vercel.app"
   
   # Cloudinary
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your-cloud-name"
   CLOUDINARY_API_KEY="your-api-key"
   CLOUDINARY_API_SECRET="your-api-secret"
   ```

### 3. Cloudinary Media Storage
1. Visit https://cloudinary.com/console
2. Create account and note:
   - Cloud name
   - API Key
   - API Secret
3. Create upload presets:
   - `blog_featured_images` (1200x630, auto quality)
   - `blog_content_images` (1000px width, auto quality)
   - `user_avatars` (200x200, face detection)

### 4. Cloudflare DNS & CDN
1. Add domain to Cloudflare
2. Update nameservers at domain registrar
3. DNS Records:
   ```
   Type: CNAME
   Name: @
   Target: cname.vercel-dns.com
   
   Type: CNAME  
   Name: www
   Target: cname.vercel-dns.com
   ```
4. Page Rules for caching:
   ```
   /_next/static/*
   Cache Level: Cache Everything
   Browser Cache TTL: 1 year
   ```

## 🔧 Environment Variables

### Required for Production
```bash
# Database (Neon)
POSTGRES_PRISMA_URL="postgresql://..."
POSTGRES_URL_NON_POOLING="postgresql://..."

# Authentication  
NEXTAUTH_SECRET="32-char-random-string"
NEXTAUTH_URL="https://yourdomain.com"
JWT_SECRET="different-32-char-string"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Media Storage (Cloudinary)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key" 
CLOUDINARY_API_SECRET="your-api-secret"
CLOUDINARY_UPLOAD_PRESET="your-upload-preset"

# Site Configuration
NEXT_PUBLIC_SITE_URL="https://yourdomain.com"
NEXT_PUBLIC_SITE_NAME="The Corporate Blog"
```

### Optional for Enhanced Features
```bash
# Analytics
NEXT_PUBLIC_GA_ID="G-XXXXXXXXXX"
NEXT_PUBLIC_VERCEL_ANALYTICS_ID="auto-generated"

# Error Tracking
SENTRY_DSN="your-sentry-dsn"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL="your-redis-url"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Test locally with `npm run dev`
- [ ] Run type checking: `npm run type-check`
- [ ] Run linting: `npm run lint`
- [ ] Test build: `npm run build`
- [ ] Verify environment variables

### Database Setup
- [ ] Initialize Prisma: `npx prisma generate`
- [ ] Push schema: `npx prisma db push`
- [ ] Seed initial data (optional): `npx prisma db seed`

### Production Deployment
- [ ] Deploy to Vercel: `vercel --prod`
- [ ] Set all environment variables in Vercel dashboard
- [ ] Configure custom domain in Vercel
- [ ] Set up Cloudflare DNS
- [ ] Test all functionality in production

### Post-Deployment
- [ ] Test Google OAuth login
- [ ] Test image uploads to Cloudinary
- [ ] Verify SEO meta tags
- [ ] Test site performance (Lighthouse)
- [ ] Set up monitoring/alerts

## 🛠️ Commands Reference

### Development
```bash
npm run dev              # Start development server
npm run type-check       # TypeScript checking
npm run lint            # ESLint checking
npm run test            # Run tests
```

### Database
```bash
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema changes
npm run db:migrate      # Create and run migrations  
npm run db:studio       # Open Prisma Studio
```

### Production
```bash
npm run build           # Build for production
npm run start           # Start production server
vercel --prod          # Deploy to Vercel
```

## ⚡ Performance Optimization

### Image Optimization
- All images automatically optimized via Cloudinary
- WebP format served when supported
- Responsive images with srcset
- Lazy loading enabled

### Caching Strategy
- Static assets: 1 year cache (Cloudflare)
- API routes: 60s cache with stale-while-revalidate
- ISR pages: 15 minutes revalidation
- Database queries: Optimized with indexes

### Monitoring
- Core Web Vitals tracking via Vercel Analytics
- Error tracking via Sentry (optional)
- Database performance via Neon metrics
- CDN analytics via Cloudflare

## 🔒 Security

### Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff  
- Referrer-Policy: origin-when-cross-origin
- Permissions-Policy configured

### Authentication
- NextAuth.js with secure sessions
- Google OAuth integration
- JWT tokens with expiration
- Role-based access control

### Data Protection
- Environment variables properly secured
- Database connections over SSL
- HTTPS enforced via Cloudflare
- Input validation with Zod schemas

## 📞 Support

### Troubleshooting
1. Check Vercel function logs
2. Verify environment variables
3. Test database connectivity
4. Check Cloudinary upload limits
5. Verify DNS propagation

### Resources
- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Cloudflare Documentation](https://developers.cloudflare.com)