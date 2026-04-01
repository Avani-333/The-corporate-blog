# Monitoring Configuration Example
# Add these to your .env.local, .env.production, or backend .env

# ============================================================================
# SENTRY ERROR TRACKING
# ============================================================================

# Frontend Sentry DSN
# Get from: https://sentry.io/ -> Projects -> Frontend -> Settings
NEXT_PUBLIC_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0

# Backend Sentry DSN
# Get from: https://sentry.io/ -> Projects -> Backend -> Settings
SENTRY_DSN=https://exampleKey@o0.ingest.sentry.io/0

# Application version (for Sentry tracking)
NEXT_PUBLIC_APP_VERSION=1.0.0

# ============================================================================
# UPTIME MONITORING CONFIGURATION
# ============================================================================

# Health check interval (in seconds)
# Default: 300 (5 minutes)
HEALTH_CHECK_INTERVAL=300

# Health check timeout (in seconds)
# Default: 10
HEALTH_CHECK_TIMEOUT=10

# ============================================================================
# ALERT POLICY CONFIGURATION
# ============================================================================

# Email for alerts
ALERT_EMAIL=ops@example.com
ALERT_EMAIL_SECONDARY=backup-ops@example.com

# Slack webhook for alerts
# Create at: https://api.slack.com/messaging/webhooks
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Slack webhook for critical alerts (optional)
SLACK_WEBHOOK_CRITICAL=https://hooks.slack.com/services/YOUR/CRITICAL/WEBHOOK

# PagerDuty integration key (optional)
PAGERDUTY_KEY=your-pagerduty-integration-key

# Alert thresholds
# 5xx error rate threshold (percent)
ALERT_ERROR_5XX_THRESHOLD=5

# Slow route threshold (milliseconds)
ALERT_SLOW_ROUTE_THRESHOLD=1500

# Uptime threshold (percent)
ALERT_UPTIME_THRESHOLD=99.5

# Error throughput threshold (requests per minute)
ALERT_ERROR_THROUGHPUT_THRESHOLD=100

# ============================================================================
# LOG RETENTION CONFIGURATION
# ============================================================================

# Log level (debug, info, warn, error)
LOG_LEVEL=info

# Log archive destination
# Options: 'local', 's3', 'gcs'
LOG_ARCHIVE_DESTINATION=local

# S3 configuration for log archival (if using S3)
LOG_ARCHIVE_S3_BUCKET=my-logs-bucket
LOG_ARCHIVE_S3_REGION=us-east-1
LOG_ARCHIVE_S3_PATH=/logs

# GCS configuration for log archival (if using GCS)
LOG_ARCHIVE_GCS_BUCKET=my-logs-bucket
LOG_ARCHIVE_GCS_PROJECT_ID=my-project-id

# Log retention days
# Error logs retention
LOG_RETENTION_ERROR_DAYS=90

# Warning logs retention
LOG_RETENTION_WARN_DAYS=30

# Info logs retention
LOG_RETENTION_INFO_DAYS=14

# Debug logs retention
LOG_RETENTION_DEBUG_DAYS=7

# Log retention max size (in MB)
LOG_RETENTION_ERROR_SIZE_MB=5000
LOG_RETENTION_WARN_SIZE_MB=2000
LOG_RETENTION_INFO_SIZE_MB=1000
LOG_RETENTION_DEBUG_SIZE_MB=500

# Enable log sampling in production
LOG_SAMPLING_ENABLED=true

# Log sampling rate (0-1, e.g., 0.1 = 10%)
LOG_SAMPLING_RATE=0.1

# ============================================================================
# SMTP CONFIGURATION (for email alerts)
# ============================================================================

# SMTP Host
SMTP_HOST=smtp.gmail.com

# SMTP Port
SMTP_PORT=587

# SMTP Username
SMTP_USER=your-email@gmail.com

# SMTP Password (use app-specific password for Gmail)
SMTP_PASS=your-app-specific-password

# From email address
FROM_EMAIL=alerts@example.com

# From name
FROM_NAME=TCB Monitoring Alerts

# ============================================================================
# MONITORING DASHBOARD
# ============================================================================

# Enable monitoring dashboard
ENABLE_MONITORING_DASHBOARD=true

# Dashboard refresh interval (seconds)
DASHBOARD_REFRESH_INTERVAL=30

# ============================================================================
# METRICS AND PROFILING
# ============================================================================

# Enable Sentry performance monitoring
SENTRY_TRACES_SAMPLE_RATE=0.1

# Enable Sentry profiling
SENTRY_PROFILES_SAMPLE_RATE=0.1

# Enable session replay (for error cases)
SENTRY_REPLAY_SESSION_SAMPLE_RATE=0.1
SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=1.0

# ============================================================================
# REGION AND DEPLOYMENT INFO
# ============================================================================

# AWS Region (for regional tagging in Sentry)
REGION=us-east-1

# Environment
NODE_ENV=production

# ============================================================================
# NOTES
# ============================================================================

# 1. SENTRY SETUP
#    - Create Sentry account at https://sentry.io
#    - Create separate projects for frontend and backend
#    - Copy DSNs from project settings
#
# 2. SLACK INTEGRATION
#    - Create webhook: https://api.slack.com/messaging/webhooks
#    - Select channel for alerts
#    - Copy webhook URL
#
# 3. EMAIL ALERTS
#    - Configure SMTP settings (Gmail, SendGrid, etc.)
#    - For Gmail: Use app-specific password
#    - Test: Send test alert from dashboard
#
# 4. LOG ARCHIVAL
#    - Choose destination: local filesystem, S3, or GCS
#    - If using S3/GCS: Provide credentials
#    - Configure retention per log level
#
# 5. MONITORING ENDPOINTS
#    - GET  /health
#    - GET  /health/detailed
#    - GET  /health/metrics
#    - GET  /health/alerts
#    - GET  /health/alerts/policies
#    - GET  /health/logs/policies
#    - POST /health/alerts/{policyId}/enable
#    - POST /health/alerts/{policyId}/disable
#
# 6. DEFAULTS (don't modify unless needed)
#    - Error threshold: 5%
#    - Slow route: 1.5 seconds
#    - Uptime: 99.5%
#    - Check interval: 5 minutes
