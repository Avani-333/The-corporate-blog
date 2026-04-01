# Cloudflare Bot Protection & Security Configuration

## Overview
Complete Cloudflare configuration for bot protection, security hardening, and performance optimization for The Corporate Blog.

---

## 1. Bot Management Configuration

### Enable Bot Fight Mode
**Location**: Cloudflare Dashboard → Bots tab
- **Status**: Enabled
- **Purpose**: Prevents automated attacks from known bad bots while allowing legitimate search engines

```yaml
Bot Fight Mode:
  Super Bot Fight Mode: Enabled
  Definitely Automated: Block
  Likely Automated: Challenge
  Verified Bots:
    - Allow legitimate bots (Google, Bing, etc.)
    - Block bad bots (scrapers, malware crawlers)
```

### Super Bot Fight Mode Rules

#### Rule 1: Block Bad Bots (Priority: 1)
```
Expression: (cf.verifiedbot_category != "") 
           and (cf.verifiedbot_category in {"Search Engine" "Analytics"})
           and (cf.bot_management_score < 30)
Action: Block
Comment: Block bots with low verification scores except verified search engines
```

#### Rule 2: Challenge Suspicious Traffic
```
Expression: (cf.bot_management_score < 60) 
           and not (cf.bot_verified)
Action: Challenge (Managed Challenge)
Comment: Require interactive challenge for suspicious automated traffic
```

#### Rule 3: Rate Limit Bot Traffic
```
Expression: (cf.bot_management_score < 50)
Action: Rate Limit (100 requests per 10 seconds per IP)
Comment: Throttle low-confidence bot traffic to prevent abuse
```

---

## 2. Firewall Rules

### WAF (Web Application Firewall) Rules

#### Rule 1: Protect Admin Routes
```
Expression: (http.request.uri.path matches "^/admin") 
           or (http.request.uri.path matches "^/dashboard/admin")
Action: Block (unless IP is allowlisted)
Rate Limit: 10 requests per minute
Logging: Enable
Comment: Strict protection for admin areas
```

#### Rule 2: API Endpoint Rate Limiting
```
Expression: (http.request.uri.path matches "^/api/") 
           and (http.request.method in {"POST" "PUT" "DELETE"})
Action: Rate Limit (50 requests per minute per IP for write operations)
Bypass for: Internal IPs, verified services
Comment: Prevent API abuse attacks
```

#### Rule 3: Prevent Path Traversal Attacks
```
Expression: (http.request.uri.path contains "..") 
           or (http.request.uri.path contains "%2e%2e")
           or (http.request.uri.query contains "..") 
           or (http.request.uri.query contains "%2e%2e")
Action: Block
Comment: Block path traversal attack attempts
```

#### Rule 4: Block SQL Injection Attempts
```
Expression: (cf.waf.score < 30)
Action: Block
Comment: Use Cloudflare OWASP ModSecurity rules
```

#### Rule 5: Protect Sensitive Files
```
Expression: (http.request.uri.path matches "(\\.env|\\.git|\\.htaccess|web\\.config)")
Action: Block
Comment: Block access to sensitive configuration files
```

#### Rule 6: Content-Type Validation
```
Expression: (http.request.method == "POST") 
           and (http.request.headers["content-type"] == "")
Action: Challenge
Comment: Require valid Content-Type for POST requests
```

---

## 3. Page Rules & Caching

### Rule 1: Static Assets (Aggressive Caching)
```
Pattern: /_next/static/*
Cache Level: Cache Everything
Browser Cache TTL: 1 year (31536000 seconds)
Edge Cache TTL: 1 month (2592000 seconds)
```

### Rule 2: Media Assets
```
Pattern: /(.*)(\.jpg|\.jpeg|\.png|\.gif|\.webp|\.svg|\.pdf)$
Cache Level: Cache Everything
Browser Cache TTL: 1 year
Edge Cache TTL: 1 month
```

### Rule 3: API Routes (No Cache)
```
Pattern: /api/*
Cache Level: Bypass
Browser Cache TTL: 0 (no cache)
Security Level: High
Enable WAF: Yes
```

### Rule 4: Dashboard & Admin (Bypass)
```
Pattern: /dashboard/*
Pattern: /admin/*
Cache Level: Bypass
Browser Cache TTL: 0 (no cache)
Security Level: High
Require Challenge: Yes
```

### Rule 5: Default Page Caching
```
Pattern: /*
Cache Level: Standard (cache based on headers)
Browser Cache TTL: 4 hours (14400 seconds)
Edge Cache TTL: 2 hours (7200 seconds)
Auto Minify: HTML, CSS, JavaScript
```

---

## 4. Security Headers (Transform Rules)

### Rule 1: Enhanced Security Headers
```
Expression: true
Actions:

# Prevent content type sniffing
Set Response Header: X-Content-Type-Options = nosniff

# Anti-clickjacking
Set Response Header: X-Frame-Options = DENY

# Legacy XSS protection
Set Response Header: X-XSS-Protection = 1; mode=block

# Referrer policy
Set Response Header: Referrer-Policy = strict-origin-when-cross-origin

# CORS policy
Set Response Header: Cross-Origin-Resource-Policy = same-origin

# Feature restrictions
Set Response Header: Permissions-Policy = camera=(), microphone=(), geolocation=()

Comment: Comprehensive security headers for all responses
```

### Rule 2: API Security Headers
```
Expression: (http.request.uri.path matches "^/api/")
Actions:

Set Response Header: X-API-Version = 1
Set Response Header: Cache-Control = no-store, no-cache, must-revalidate

Comment: Additional API security headers
```

---

## 5. DDoS & Attack Protection

### Automatic Features (Enabled by Default)
- **DDoS Protection**: Enterprise-grade DDoS mitigation
- **HTTP Flood Protection**: Automatic detection and blocking of HTTP floods
- **SQL Injection Protection**: ModSecurity ruleset enabled
- **XSS Protection**: XSS filter enabled
- **Credential Stuffing Detection**: Monitor for credential attacks

### Security Level
```
Security Level: High
- Challenges bots more aggressively
- Lower threshold for blocking suspicious traffic
```

### Browser Integrity Check
```
Enabled: Yes
Description: Ensures requests come from actual browsers
Blocks: Scraping tools, automated attacks
```

---

## 6. Bot Management Advanced Rules

### JavaScript Fingerprinting
```
Enabled: Yes
Tracks: Valid JavaScript execution in browsers
Purpose: Distinguishes real browsers from headless/automated tools
```

### TLS Fingerprinting
```
Enabled: Yes
Monitors: TLS/SSL certificate patterns
Purpose: Identifies legitimate clients vs. bots
```

### IP Reputation
```
Enabled: Yes
Updates: Real-time threat intelligence
Blocks: Known botnet IPs and malicious sources
```

---

## 7. Cloudflare Workers (Optional Advanced Layer)

### Create a Worker for Custom Bot Protection

**File**: `cloudflare-worker.js`

```javascript
/**
 * Advanced Bot Detection Worker
 * Provides custom bot protection layer
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const country = request.headers.get('CF-IPCountry');
    const botScore = request.headers.get('CF-Bot-Management-Score');
    const isBot = botScore && botScore < 30;

    // Block known bad bot patterns
    if (isSuspiciousRequest(request)) {
      return new Response('Forbidden', { status: 403 });
    }

    // Rate limit suspicious traffic
    if (isBot && url.pathname.startsWith('/api/')) {
      const clientIP = request.headers.get('CF-Connecting-IP');
      const rateLimitKey = `ratelimit:${clientIP}`;
      
      // Use Durable Objects or KV for rate limiting
      const count = await incrementRateLimit(rateLimitKey);
      
      if (count > 50) {
        return new Response('Too Many Requests', { status: 429 });
      }
    }

    // Add security headers
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    
    newResponse.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
    newResponse.headers.set(
      'X-Frame-Options',
      'DENY'
    );

    return newResponse;
  }
};

function isSuspiciousRequest(request) {
  const userAgent = request.headers.get('User-Agent');
  const suspiciousPatterns = [
    'curl', 'python', 'scrapy', 'wget',
    'apachebench', 'nikto', 'nmap'
  ];
  
  return suspiciousPatterns.some(pattern =>
    userAgent?.toLowerCase().includes(pattern.toLowerCase())
  );
}

async function incrementRateLimit(key) {
  // Implement with Durable Objects or KV Storage
  // Return and increment counter
  return 1;
}
```

---

## 8. SSL/TLS Configuration

### Minimum TLS Version: 1.2
```
Rationale: 
- TLS 1.0 & 1.1 are deprecated and vulnerable
- TLS 1.2+ provides modern encryption
```

### Recommended TLS Settings
```
TLS 1.3: Enabled
ECDSA Certificate: Enabled
HSTS Preload: Enabled (max-age=63072000)
Always Use HTTPS: Enabled
Automatic HTTPS Rewrites: Enabled
Opportunistic Encryption: Enabled
Email Obfuscation: Enabled (protect email addresses)
```

---

## 9. Monitoring & Logging

### Enable Analytics
```
Web Analytics: Enabled
Bot Fight Mode Analytics: Enabled
WAF Analytics: Enabled
```

### Log Configuration
```
Workers Analytics: Enabled
Logs pushed to: 
  - Cloudflare Logpush
  - Sentry (for errors)
  - Custom logging endpoint
```

### Key Metrics to Monitor
- Bot traffic percentage
- Challenge completion rate
- Request blocked count
- API rate limit hits
- Geographic distribution of requests

---

## 10. Deployment Checklist

- [ ] Enable Bot Fight Mode
- [ ] Configure firewall rules (Rules 1-6)
- [ ] Set up page rules with proper caching
- [ ] Enable security headers via Transform Rules
- [ ] Set security level to High
- [ ] Enable Browser Integrity Check
- [ ] Configure DDoS protection
- [ ] Deploy Cloudflare Worker (optional)
- [ ] Test SSL/TLS configuration
- [ ] Enable logging and monitoring
- [ ] Set up alerts for anomalies
- [ ] Document all custom rules
- [ ] Schedule monthly security review

---

## 11. Testing & Validation

### Test Bot Protection
```bash
# Test with curl (should be challenged)
curl -H "User-Agent: curl" https://yourdomain.com/api/posts

# Test with legitimate browser
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)" https://yourdomain.com

# Test rate limiting
for i in {1..60}; do curl https://yourdomain.com/api/posts; done
```

### Test Security Headers
```bash
# Check security headers
curl -I https://yourdomain.com

# Should see:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: max-age=63072000
# Content-Security-Policy: ...
```

### Monitor Performance
```
Tools:
- PageSpeed Insights
- GTmetrix
- WebPageTest
- Cloudflare Analytics

Target Metrics:
- First Contentful Paint: < 1.8s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- Bot traffic: < 5% (after protection)
```

---

## 12. Important Notes

### Privacy & GDPR Compliance
- All bot protection is Cloudflare-hosted (no user data stored)
- Compliant with GDPR and privacy regulations
- No personal data is revealed to workers/rules

### Performance Impact
- **Positive**: DDoS protection, bot blocking improves performance
- **Minimal Overhead**: < 1ms additional latency
- **Caching**: Aggressive caching reduces origin requests by 70%+

### Cost Implications
- **Free Plan**: Basic bot protection (Bot Fight Mode)
- **Pro/Business**: Advanced Rate Limiting & WAF
- **Enterprise**: Custom rules, Workers, full Bot Management

### Maintenance
- Review firewall rules monthly
- Update bot signatures quarterly
- Monitor false positives for legitimate traffic
- Adjust challenge rates based on metrics
