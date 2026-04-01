# Cloudflare Configuration for The Corporate Blog

## DNS Records
```
Type: CNAME
Name: @
Target: cname.vercel-dns.com
Proxy: ✅ Proxied

Type: CNAME
Name: www  
Target: cname.vercel-dns.com
Proxy: ✅ Proxied

Type: CNAME
Name: api
Target: cname.vercel-dns.com  
Proxy: ✅ Proxied
```

## Page Rules (Order matters!)
```
1. Rule: /_next/static/*
   Settings:
   - Cache Level: Cache Everything
   - Browser Cache TTL: 1 year
   - Edge Cache TTL: 1 month

2. Rule: /*.jpg, /*.jpeg, /*.png, /*.gif, /*.webp, /*.svg
   Settings:
   - Cache Level: Cache Everything
   - Browser Cache TTL: 1 year
   - Edge Cache TTL: 1 month

3. Rule: /api/*
   Settings:
   - Cache Level: Bypass
   - Security Level: Medium
   - Disable Apps
   
4. Rule: /admin/*
   Settings:
   - Cache Level: Bypass  
   - Security Level: High
   - Challenge Passage: 1 hour

5. Rule: /*
   Settings:
   - Cache Level: Standard
   - Browser Cache TTL: 4 hours
   - Edge Cache TTL: 2 hours
   - Auto Minify: HTML, CSS, JS
```

## Transform Rules
```
# Security Headers
Rule Name: Security Headers
Expression: true
Actions:
- Set Response Header: X-Frame-Options = DENY
- Set Response Header: X-Content-Type-Options = nosniff
- Set Response Header: Referrer-Policy = origin-when-cross-origin
- Set Response Header: Permissions-Policy = camera=(), microphone=(), geolocation=()

# CORS for API
Rule Name: API CORS
Expression: http.request.uri.path matches "^/api/"
Actions:  
- Set Response Header: Access-Control-Allow-Origin = *
- Set Response Header: Access-Control-Allow-Methods = GET, POST, PUT, DELETE, OPTIONS
- Set Response Header: Access-Control-Allow-Headers = Content-Type, Authorization
```

## Firewall Rules
```
# Block common threats
Rule 1: Block Known Bad Bots
Expression: (cf.client.bot) and not (cf.verified_bot_category in {"Search Engine" "Analytics"})
Action: Block

# Rate limiting for API
Rule 2: API Rate Limiting  
Expression: http.request.uri.path matches "^/api/"
Action: Rate Limit (100 requests per minute per IP)

# Protect admin area
Rule 3: Admin Protection
Expression: http.request.uri.path matches "^/admin"
Action: Challenge (Managed Challenge)
```

## SSL/TLS Configuration  
```
SSL/TLS Mode: Full (strict)
Always Use HTTPS: On
HTTP Strict Transport Security (HSTS): Enabled
- Max Age Header: 12 months
- Include Subdomains: On
- Preload: On

Minimum TLS Version: 1.2
TLS 1.3: On
Automatic HTTPS Rewrites: On
```

## Speed Optimization
```
Auto Minify:
- HTML: On
- CSS: On  
- JavaScript: On

Brotli: On
Early Hints: On
Rocket Loader: Off (to avoid conflicts with React)
Mirage: On
Polish: Lossless
WebP: On
```

## Analytics & Monitoring
```
Web Analytics: On
Bot Fight Mode: On
Browser Insights: On
Core Web Vitals: On
```

## Worker Script (Optional Advanced Caching)
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Cache static assets aggressively
  if (url.pathname.startsWith('/_next/static/')) {
    const response = await fetch(request)
    const newResponse = new Response(response.body, response)
    newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    return newResponse
  }
  
  // Cache API responses briefly  
  if (url.pathname.startsWith('/api/')) {
    const cacheKey = new Request(url.toString(), request)
    const cache = caches.default
    
    let response = await cache.match(cacheKey)
    
    if (!response) {
      response = await fetch(request)
      
      if (response.status === 200) {
        const newResponse = new Response(response.body, response)
        newResponse.headers.set('Cache-Control', 'public, max-age=60')
        await cache.put(cacheKey, newResponse.clone())
        return newResponse
      }
    }
    
    return response
  }
  
  return fetch(request)
}
```

## Setup Commands
```bash
# Install Cloudflare CLI (optional)
npm install -g @cloudflare/wrangler

# Test DNS propagation
nslookup yourdomain.com
dig yourdomain.com

# Test SSL
curl -I https://yourdomain.com

# Test caching
curl -I https://yourdomain.com/_next/static/css/styles.css
```

## Performance Testing
```bash
# Test Core Web Vitals
npx @lhci/cli@0.12.x autorun

# Test with GTmetrix
# Visit: https://gtmetrix.com

# Test with PageSpeed Insights  
# Visit: https://pagespeed.web.dev

# Test with WebPageTest
# Visit: https://www.webpagetest.org
```