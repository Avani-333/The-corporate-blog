#!/bin/bash

# Weekly database export via cron
# Schedule this script to run weekly (e.g., every Sunday at 2 AM)
# Add to crontab:
#   0 2 * * 0 /path/to/weekly-export-cron.sh
# 
# Or with environment:
#   0 2 * * 0 /bin/bash -c 'cd /app && NODE_ENV=production ./scripts/weekly-export-cron.sh'

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

# Load environment
cd "$(dirname "$0")/.."
source .env.production 2>/dev/null || source .env.staging || true

# Export variables
export NODE_ENV="${NODE_ENV:-staging}"
export EXPORT_DIR="${EXPORT_DIR:-./exports}"
export LOG_DIR="${LOG_DIR:-./logs}"
export VERBOSE="${VERBOSE:-false}"

# Create log directory
mkdir -p "$LOG_DIR"

# Generate log file name
LOG_FILE="$LOG_DIR/export-$(date +%Y%m%d-%H%M%S).log"
ERROR_LOG="$LOG_DIR/export-errors.log"

# ============================================================================
# LOGGING
# ============================================================================

exec 1>>"$LOG_FILE"
exec 2>>"$ERROR_LOG"

echo "=========================================="
echo "Weekly Database Export - Cron Job"
echo "=========================================="
echo "Start Time: $(date)"
echo "Environment: $NODE_ENV"
echo "Export Dir: $EXPORT_DIR"
echo "Log File: $LOG_FILE"
echo ""

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================

echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    exit 1
fi

# Check required environment variables
if [ -z "${POSTGRES_URL_NON_POOLING:-}" ] && [ -z "${DATABASE_URL:-}" ]; then
    echo "❌ No database URL configured"
    exit 1
fi

# Check disk space (need at least 20GB free)
AVAILABLE_SPACE=$(df "$EXPORT_DIR" | awk 'NR==2 {print int($4/1024/1024)}')
REQUIRED_SPACE=20480  # 20GB in MB

if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
    echo "⚠️  Warning: Low disk space (${AVAILABLE_SPACE}MB available, need ${REQUIRED_SPACE}MB)"
    # Continue anyway, might just compress better than expected
fi

echo "✅ Pre-flight checks passed"
echo ""

# ============================================================================
# RUN EXPORT
# ============================================================================

echo "Starting database export..."
START_TIME=$(date +%s)

if node scripts/weekly-export.js >> "$LOG_FILE" 2>&1; then
    EXPORT_STATUS="success"
    echo "✅ Export completed successfully"
else
    EXPORT_STATUS="failed"
    echo "❌ Export failed"
    cat "$ERROR_LOG" | tail -20
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
DURATION_MIN=$((DURATION / 60))

echo ""
echo "=========================================="
echo "Export Summary"
echo "=========================================="
echo "Status: $EXPORT_STATUS"
echo "Duration: ${DURATION_MIN} minutes"
echo "End Time: $(date)"
echo ""

# ============================================================================
// VERIFICATION
// ============================================================================

if [ "$EXPORT_STATUS" = "success" ]; then
    echo "Verifying exports..."
    
    # Check file counts
    FILE_COUNT=$(find "$EXPORT_DIR" -type f -name "export-*" -mmin -$((DURATION_MIN + 5)) 2>/dev/null | wc -l)
    
    if [ "$FILE_COUNT" -gt 0 ]; then
        echo "✅ $FILE_COUNT export files created"
        
        # Show recent files
        echo ""
        echo "Recent exports:"
        ls -lh "$EXPORT_DIR" | tail -5
    else
        echo "⚠️  No export files found"
    fi
fi

echo ""

# ============================================================================
// NOTIFICATIONS
// ============================================================================

if [ ! -z "${SLACK_WEBHOOK:-}" ]; then
    echo "Sending notification to Slack..."
    
    # Prepare notification
    if [ "$EXPORT_STATUS" = "success" ]; then
        COLOR="good"
        EMOJI="✅"
        TITLE="Weekly Database Export Successful"
    else
        COLOR="danger"
        EMOJI="❌"
        TITLE="Weekly Database Export Failed"
    fi
    
    # Send to Slack
    curl -X POST "$SLACK_WEBHOOK" \
        -H 'Content-type: application/json' \
        --data-binary @- << EOF
{
    "attachments": [
        {
            "fallback": "$TITLE",
            "color": "$COLOR",
            "title": "$TITLE",
            "text": "Database export has completed",
            "fields": [
                {
                    "title": "Environment",
                    "value": "$NODE_ENV",
                    "short": true
                },
                {
                    "title": "Status",
                    "value": "$EMOJI $EXPORT_STATUS",
                    "short": true
                },
                {
                    "title": "Duration",
                    "value": "${DURATION_MIN} minutes",
                    "short": true
                },
                {
                    "title": "Time",
                    "value": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
                    "short": true
                }
            ],
            "footer": "Database Export System",
            "ts": $(date +%s)
        }
    ]
}
EOF
    
    echo "✅ Notification sent"
fi

echo ""
echo "=========================================="
echo "Cron job completed"
echo "=========================================="
