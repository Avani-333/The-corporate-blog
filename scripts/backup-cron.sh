#!/bin/bash

# Automated Database Backup Script
# Runs daily at 2 AM via cron

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS=${RETENTION_DAYS:-30}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATABASES=("thecorporateblog_dev" "thecorporateblog_test" "thecorporateblog_staging")

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "🗄️  Starting automated database backup - $(date)"

# Function to create backup for a database
backup_database() {
    local db_name=$1
    local backup_file="$BACKUP_DIR/backup_${db_name}_${TIMESTAMP}.sql"
    local compressed_file="${backup_file}.gz"
    
    echo "📦 Backing up database: $db_name"
    
    # Create backup
    if pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db_name" > "$backup_file"; then
        # Compress backup
        gzip "$backup_file"
        echo "✅ Backup created: $(basename "$compressed_file")"
        
        # Calculate size
        local size=$(du -h "$compressed_file" | cut -f1)
        echo "   Size: $size"
    else
        echo "❌ Failed to backup $db_name"
        # Clean up partial backup
        rm -f "$backup_file" "$compressed_file"
        return 1
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    echo "🧹 Cleaning up backups older than $RETENTION_DAYS days"
    
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -print0 | while IFS= read -r -d '' file; do
        echo "   Removing: $(basename "$file")"
        rm -f "$file"
    done
}

# Function to verify backup integrity
verify_backup() {
    local compressed_file=$1
    echo "🔍 Verifying backup integrity: $(basename "$compressed_file")"
    
    if gzip -t "$compressed_file"; then
        echo "✅ Backup integrity verified"
        return 0
    else
        echo "❌ Backup integrity check failed"
        return 1
    fi
}

# Function to send notification (optional)
send_notification() {
    local status=$1
    local message=$2
    
    # Placeholder for notification service integration
    # Could integrate with Slack, Discord, email, etc.
    
    if [ "$status" = "success" ]; then
        echo "✅ BACKUP SUCCESS: $message"
    else
        echo "❌ BACKUP FAILED: $message" >&2
    fi
}

# Main backup process
main() {
    local failed_count=0
    local total_backups=0
    
    # Create backups for each database
    for db in "${DATABASES[@]}"; do
        if backup_database "$db"; then
            # Verify the backup
            local backup_file="$BACKUP_DIR/backup_${db}_${TIMESTAMP}.sql.gz"
            if verify_backup "$backup_file"; then
                ((total_backups++))
            else
                ((failed_count++))
                rm -f "$backup_file"
            fi
        else
            ((failed_count++))
        fi
    done
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Generate summary
    local success_count=$((total_backups - failed_count))
    echo ""
    echo "📊 Backup Summary:"
    echo "   Successful: $success_count"
    echo "   Failed: $failed_count"
    echo "   Total: $total_backups"
    echo "   Timestamp: $TIMESTAMP"
    
    # Send notification based on results
    if [ $failed_count -eq 0 ]; then
        send_notification "success" "All $total_backups database backups completed successfully"
        echo "🎉 Backup process completed successfully - $(date)"
        exit 0
    else
        send_notification "failure" "$failed_count out of $total_backups backups failed"
        echo "⚠️  Backup process completed with errors - $(date)"
        exit 1
    fi
}

# Health check function
health_check() {
    echo "🏥 Performing database health check..."
    
    for db in "${DATABASES[@]}"; do
        if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" -c "SELECT 1" > /dev/null 2>&1; then
            echo "✅ $db - healthy"
        else
            echo "❌ $db - connection failed"
            return 1
        fi
    done
    
    echo "✅ All databases are healthy"
}

# Command line options
case "${1:-backup}" in
    "backup")
        health_check && main
        ;;
    "health")
        health_check
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    "verify")
        if [ -z "$2" ]; then
            echo "Usage: $0 verify <backup-file>"
            exit 1
        fi
        verify_backup "$2"
        ;;
    *)
        echo "Usage: $0 [backup|health|cleanup|verify]"
        echo ""
        echo "Commands:"
        echo "  backup   - Create database backups (default)"
        echo "  health   - Check database connectivity"
        echo "  cleanup  - Remove old backup files"
        echo "  verify   - Verify backup file integrity"
        exit 1
        ;;
esac