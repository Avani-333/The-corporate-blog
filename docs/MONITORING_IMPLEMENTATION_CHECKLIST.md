# Monitoring & Alerting Implementation Checklist

Complete checklist for Sentry, uptime monitoring, alert policies, and log retention integration.

## ✅ Backend Implementation

### Sentry Setup
- [x] Created Sentry configuration file (`backend/src/config/sentry.ts`)
- [x] Integrated Sentry middleware in Express app
- [x] Added error handler middleware
- [x] Configured request tracking and breadcrumbs
- [x] Environment variable support (SENTRY_DSN)

### Uptime Monitoring
- [x] Created uptime monitor service (`backend/src/services/uptimeMonitor.ts`)
- [x] Health check implementation (5-minute interval)
- [x] Database connectivity check
- [x] Redis connectivity check (optional)
- [x] External services check
- [x] Metrics tracking (uptime %, success rate)
- [x] Auto-initialization in server startup

### Alert Policies
- [x] Alert policy manager (`backend/src/services/alertPolicies.ts`)
- [x] Pre-configured 4 default policies:
  - [x] 5xx error rate > 5%
  - [x] Response time > 1.5s
  - [x] Uptime < 99.5%
  - [x] Error throughput > 100/min
- [x] Email alert action
- [x] Slack alert action
- [x] PagerDuty alert action (stub)
- [x] Webhook alert action (stub)
- [x] Alert history tracking
- [x] Policy enable/disable functionality

### Log Retention
- [x] Log retention manager (`backend/src/services/logRetention.ts`)
- [x] Default retention policies:
  - [x] Error: 90 days, 5GB
  - [x] Warn: 30 days, 2GB
  - [x] Info: 14 days, 1GB
  - [x] Debug: 3-7 days, 500MB
- [x] Log sampling support
- [x] Archive support (gzip format)
- [x] Cleanup scheduling (every 6 hours)
- [x] Storage usage tracking
- [x] Log metrics collection

### Health Check Endpoints
- [x] `GET /health` - Basic health check
- [x] `GET /health/detailed` - Detailed status
- [x] `GET /health/metrics` - Raw metrics
- [x] `GET /health/alerts` - Recent alerts
- [x] `GET /health/alerts/policies` - Alert policies
- [x] `GET /health/logs/policies` - Log retention policies
- [x] `POST /health/alerts/:policyId/enable` - Enable policy
- [x] `POST /health/alerts/:policyId/disable` - Disable policy
- [x] `POST /health/logs/cleanup` - Trigger cleanup

### Server Integration
- [x] Updated `backend/src/server.ts` to:
  - [x] Initialize uptime monitor
  - [x] Start log retention cleanup
  - [x] Flush Sentry on shutdown
  - [x] Stop monitoring on graceful shutdown

### App Integration
- [x] Updated `backend/src/app.ts` to:
  - [x] Import Sentry configuration
  - [x] Initialize Sentry in middleware
  - [x] Add Sentry request handler
  - [x] Add Sentry error handler
  - [x] Add health routes

## ✅ Frontend Implementation

### Sentry Setup
- [x] Created Sentry client config (`lib/sentry-client.ts`)
- [x] Error capture functions
- [x] Message capture functions
- [x] Breadcrumb support
- [x] User context support
- [x] Session replay configuration
- [x] Performance metrics support

### Error Tracking Integration
- [x] Updated error tracking (`lib/error-tracking.ts`) to:
  - [x] Send errors to Sentry
  - [x] Capture with context
  - [x] Report issue functionality
  - [x] Async error handlers

### API Integration
- [x] Updated error tracking endpoint (`app/api/errors/track/route.ts`) to:
  - [x] Send client errors to Sentry
  - [x] Tag errors appropriately
  - [x] Extract context information
  - [x] Log in development mode

## 📚 Documentation

- [x] Created comprehensive monitoring guide (`docs/MONITORING_AND_ALERTS.md`)
- [x] Created environment configuration example (`docs/MONITORING_ENV_EXAMPLE.md`)
- [x] Documented all health endpoints
- [x] Provided integration instructions
- [x] Added troubleshooting guide

## 🔧 Configuration Required

### Must Do (Before Production)

- [ ] Create Sentry.io account at https://sentry.io
- [ ] Create two Sentry projects (Frontend + Backend)
- [ ] Copy DSNs to environment variables:
  - [ ] Backend: `SENTRY_DSN`
  - [ ] Frontend: `NEXT_PUBLIC_SENTRY_DSN`
- [ ] Set up email alerts:
  - [ ] Configure SMTP (Gmail, SendGrid, etc.)
  - [ ] Set `ALERT_EMAIL`
  - [ ] Test email delivery
- [ ] Set up Slack (optional but recommended):
  - [ ] Create Slack webhook
  - [ ] Set `SLACK_WEBHOOK_URL`
  - [ ] Test alert delivery

### Should Do (Recommended)

- [ ] Configure alert thresholds based on your baseline:
  - [ ] `ALERT_ERROR_5XX_THRESHOLD`
  - [ ] `ALERT_SLOW_ROUTE_THRESHOLD`
  - [ ] `ALERT_UPTIME_THRESHOLD`
  - [ ] `ALERT_ERROR_THROUGHPUT_THRESHOLD`
- [ ] Set up log archival (S3 or GCS)
- [ ] Configure PagerDuty for critical alerts
- [ ] Create monitoring dashboard
- [ ] Set up log export for compliance

### Nice to Have (Optional)

- [ ] Custom monitoring dashboard
- [ ] Historical trend analysis
- [ ] API client for monitoring checks
- [ ] Mobile alerts via SMS
- [ ] Integration with incident management

## 🚀 Installation Steps

### 1. Backend Dependencies
Add to `backend/package.json`:
```bash
npm install @sentry/node @sentry/profiling-node
```

### 2. Frontend Dependencies
Already installed:
```
@sentry/nextjs: ^10.44.0
```

### 3. Environment Setup

Copy template and configure:
```bash
# Copy environment template
cp docs/MONITORING_ENV_EXAMPLE.md .env.example

# Edit for your environment
nano .env.production
```

### 4. Sentry Project Setup

Follow instructions in `docs/MONITORING_AND_ALERTS.md`:
1. Create Sentry.io account
2. Create Frontend & Backend projects
3. Copy DSNs
4. Enable features (profiling, replay, etc.)

### 5. Start Services

```bash
# Backend with monitoring
cd backend
npm install
npm run dev

# Frontend also monitors
npm run dev
```

## 📊 Verification Steps

### Test Sentry Integration

**Backend:**
```bash
# Check Sentry initialization
curl http://localhost:3001/health

# Trigger a test error
curl -X POST http://localhost:3001/api/test-error

# Check Sentry.io dashboard for event
```

**Frontend:**
```bash
# Check browser console for Sentry init
# Open DevTools > Console

# Trigger a test error
import { captureException } from '@/lib/sentry-client';
captureException(new Error('Test'));

# Check Sentry.io dashboard for event
```

### Test Health Endpoints

```bash
# Basic health
curl http://localhost:3001/health

# Detailed health
curl http://localhost:3001/health/detailed

# Metrics
curl http://localhost:3001/health/metrics

# Alerts
curl http://localhost:3001/health/alerts

# Policies
curl http://localhost:3001/health/alerts/policies
```

### Test Alerts

1. Simulate error:
```bash
curl http://localhost:3001/api/test-error
```

2. Monitor alert history:
```bash
curl http://localhost:3001/health/alerts
```

3. Check Slack/Email for notification

## 🔍 Monitoring the Monitors

### Key Metrics to Track

1. **Sentry Health**
   - Errors captured
   - Events processed
   - Organization quota usage

2. **Uptime Monitor Health**
   - Check success rate
   - Check response times
   - Health status

3. **Alert System Health**
   - Alerts triggered
   - Alert delivery success
   - False positive rate

4. **Log System Health**
   - Storage usage
   - Retention compliance
   - Cleanup success

### Regular Maintenance

- [ ] Review Sentry errors weekly
- [ ] Adjust alert thresholds monthly
- [ ] Review log retention policies quarterly
- [ ] Test alert delivery monthly
- [ ] Validate backups regularly

## 🐛 Troubleshooting

### Sentry Not Capturing Errors

**Backend:**
```bash
# Check if SENTRY_DSN is set
echo $SENTRY_DSN

# Check Sentry middleware in logs
```

**Frontend:**
```bash
# Check if DSN is set
echo $NEXT_PUBLIC_SENTRY_DSN

# Check console for init message
```

**Solution:** Verify DSN format and project permissions

### Health Checks Failing

**Debug:**
```bash
curl -v http://localhost:3001/health/detailed

# Check response for failing component
```

**Solutions:**
- Check database connectivity
- Verify Redis is running (if configured)
- Check external service availability

### Alerts Not Sending

1. **Email alerts:**
   - Check SMTP configuration
   - Verify `ALERT_EMAIL` is set
   - Check spam folder

2. **Slack alerts:**
   - Verify webhook URL
   - Check webhook hasn't expired
   - Test with manual POST

3. **Policy disabled:**
   - Check `GET /health/alerts/policies`
   - Enable with POST endpoint

## 🎯 Next Steps

1. **Immediate (Day 1):**
   - [ ] Set up Sentry account
   - [ ] Configure DSNs
   - [ ] Set up email/Slack alerts
   - [ ] Deploy to staging

2. **Short term (Week 1):**
   - [ ] Monitor dashboard
   - [ ] Adjust alert thresholds
   - [ ] Test alert delivery
   - [ ] Document playbooks

3. **Medium term (Month 1):**
   - [ ] Analyze error patterns
   - [ ] Implement fixes
   - [ ] Set up escalation
   - [ ] Create dashboards

4. **Long term (Ongoing):**
   - [ ] Continuous monitoring
   - [ ] Performance optimization
   - [ ] Incident response
   - [ ] Compliance tracking

## 📈 Observability Goals

- **Error Tracking**: 100% of production errors captured
- **Uptime**: 99.9% availability
- **Alert Response**: <5 minutes detection, <15 minutes resolution
- **Log Compliance**: Data retention per regulations
- **Performance**: <100ms p95 response time

## 📄 References

- [Sentry Documentation](https://docs.sentry.io/)
- [Next.js Sentry Integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Node.js Sentry Integration](https://docs.sentry.io/platforms/node/)
- [MONITORING_AND_ALERTS.md](./MONITORING_AND_ALERTS.md) - Complete setup guide
- [ERROR_HANDLING.md](./ERROR_HANDLING.md) - Error boundary setup

## ✨ Summary

**What's Ready:**
- ✅ Sentry configuration (frontend + backend)
- ✅ Uptime monitoring with 5-minute checks
- ✅ 4 pre-configured alert policies
- ✅ Log retention management
- ✅ Health check endpoints
- ✅ Complete documentation

**What You Need To Do:**
1. Create Sentry.io account and projects
2. Configure environment variables
3. Set up alert notifications (Slack/Email)
4. Deploy to production
5. Monitor and adjust thresholds

**Time Estimate:** 30-60 minutes for basic setup, 2-3 hours for full integration and testing.
