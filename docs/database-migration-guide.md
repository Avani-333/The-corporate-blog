# Database Migration Pipeline Guide

## Overview

The Corporate Blog uses a comprehensive database migration pipeline with PostgreSQL connection pooling, automated backups, and environment-specific configurations.

## Quick Start

### 1. Environment Setup

```bash
# Copy environment file for your environment
cp .env.example .env.local          # Development
cp .env.production.example .env     # Production  
cp .env.test.example .env.test      # Testing

# Install dependencies
npm install

# Setup database
npm run db:setup
```

### 2. Basic Migration Commands

```bash
# Check migration status
npm run migrate:status

# Generate new migration
npm run migrate:generate "add_user_preferences"

# Apply migrations
npm run migrate:apply

# Validate schema and migrations
npm run migrate:validate
```

## Database Configuration

### Connection Pooling

The system uses environment-specific connection pooling:

- **Production**: 25 connections, strict SSL, comprehensive monitoring
- **Development**: 5 connections, no SSL, minimal monitoring  
- **Test**: 2 connections, fast timeouts, no monitoring

### Environment Variables

Key configuration variables:

```env
# Core database connections
POSTGRES_PRISMA_URL              # Pooled connection (pgbouncer)
POSTGRES_URL_NON_POOLING         # Direct connection

# Pool configuration  
DB_CONNECTION_LIMIT              # Max connections per instance
DB_ACQUIRE_TIMEOUT               # Time to acquire connection
DB_IDLE_TIMEOUT                  # Connection idle timeout

# Monitoring
DB_ENABLE_METRICS                # Enable performance monitoring
DB_SLOW_QUERY_THRESHOLD          # Slow query threshold (ms)
DB_HEALTH_CHECK_INTERVAL         # Health check frequency
```

## Migration Pipeline Commands

### Core Commands

```bash
# Migration management
npm run migrate:status           # Check current migration state
npm run migrate:generate <name>  # Create new migration
npm run migrate:apply           # Apply pending migrations
npm run migrate:rollback [steps] # Rollback migrations
npm run migrate:reset           # Reset entire database

# Backup and restore
npm run migrate:backup          # Create database backup
npm run migrate:restore <file>  # Restore from backup

# Validation and health
npm run migrate:validate        # Validate schema and migrations
npm run db:health-check         # Check database connection
npm run db:monitor             # Continuous connection monitoring
```

### Direct Script Usage

```bash
# Use migration script directly for advanced options
node scripts/migrate.js <command> [options]

# Examples
node scripts/migrate.js backup
node scripts/migrate.js rollback 2
node scripts/migrate.js restore backups/backup-prod-2024-03-07.sql.gz
```

## Environment-Specific Workflows

### Development Workflow

```bash
# 1. Make schema changes in schema.prisma
# 2. Generate migration
npm run migrate:generate "add_new_feature"

# 3. Review generated migration files
# 4. Apply migration
npm run migrate:apply

# 5. Update seed data if needed
npm run db:seed
```

### Staging Deployment

```bash
# 1. Validate migrations
npm run migrate:validate

# 2. Create backup (automatic)
npm run migrate:backup

# 3. Apply migrations with confirmation
NODE_ENV=staging npm run migrate:apply

# 4. Run validation
npm run db:health-check
```

### Production Deployment

```bash
# 1. Pre-deployment validation  
npm run migrate:validate

# 2. Create backup (automatic)
npm run migrate:backup

# 3. Apply migrations (requires confirmation)
NODE_ENV=production npm run migrate:apply

# 4. Monitor health
npm run db:monitor
```

## Backup and Recovery

### Automatic Backups

Backups are automatically created:
- Before migrations in staging/production
- Compressed with gzip 
- Stored in `./backups/` directory
- Old backups cleaned up (keeps 10 most recent)

### Manual Backup

```bash
# Create backup
npm run migrate:backup

# Backup with custom name
node scripts/migrate.js backup my-backup-name
```

### Recovery Process

```bash
# List available backups
ls -la backups/

# Restore from backup
npm run migrate:restore backups/backup-prod-2024-03-07.sql.gz

# Or use script directly
node scripts/migrate.js restore backups/backup-prod-2024-03-07.sql.gz
```

## Monitoring and Health Checks

### API Health Endpoints

```bash
# Check database health
GET /api/health/database

# Response format
{
  "status": "healthy|unhealthy",
  "checks": {
    "database": {
      "status": "connected",
      "latency": 45,
      "environment": "production",
      "stats": { ... }
    },
    "timestamp": "2024-03-07T10:30:00.000Z"
  }
}
```

### Connection Monitoring

```bash
# Real-time monitoring
npm run db:monitor

# Single health check  
npm run db:health-check

# Check connection in code
import { getConnectionStatus } from '@/lib/database/connection';
const status = await getConnectionStatus();
```

## Docker Integration

### Development with Docker

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: thecorporateblog_dev
      POSTGRES_USER: postgres  
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh

  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_USER: postgres
      DATABASES_PASSWORD: password  
      DATABASES_DBNAME: thecorporateblog_dev
    ports:
      - "6432:5432"
    depends_on:
      - postgres

volumes:
  postgres_data:
```

### Running with Docker

```bash
# Start database services
docker-compose up -d postgres pgbouncer

# Run migrations
npm run migrate:apply

# Seed database
npm run db:seed
```

## Troubleshooting

### Common Issues

1. **Connection Pool Exhausted**
   ```bash
   # Check connection status
   npm run db:health-check
   
   # Monitor connections
   npm run db:monitor
   
   # Restart application to reset pool
   ```

2. **Migration Conflicts**
   ```bash
   # Check migration status
   npm run migrate:status
   
   # Validate schema
   npm run migrate:validate
   
   # Manual resolution may be required
   ```

3. **Performance Issues**
   ```bash
   # Check slow queries in logs
   # Monitor connection pool metrics
   # Consider connection limit adjustments
   ```

### Recovery Strategies

1. **Migration Failure**
   ```bash
   # Restore from backup
   npm run migrate:restore <latest-backup>
   
   # Fix migration issues
   # Retry migration
   ```

2. **Connection Issues**
   ```bash
   # Check database server status
   # Verify connection strings
   # Check SSL configuration
   # Restart connection pool
   ```

## Best Practices

### Migration Development
- Write reversible migrations when possible
- Test migrations on staging first
- Keep migrations small and focused
- Document complex schema changes

### Connection Management
- Monitor connection pool usage
- Use appropriate timeouts for environment
- Implement proper error handling
- Use read replicas for heavy read workloads

### Backup Strategy  
- Regular automated backups
- Test restore procedures
- Store backups securely
- Document recovery procedures

### Security
- Use strong SSL/TLS in production
- Rotate database credentials regularly
- Limit connection permissions
- Monitor for suspicious activity

## Advanced Configuration

### Custom Pool Settings

```typescript
// lib/database/connection.ts
const customConfig = getDatabaseConfig('production');
const prisma = new PrismaClient({
  // Custom configuration
});
```

### Migration Hooks

```javascript
// scripts/migrate.js
// Custom pre/post migration hooks
async function preMigrationHook() {
  // Custom logic before migration
}

async function postMigrationHook() {
  // Custom logic after migration  
}
```

### Monitoring Integration

```typescript
// Integration with monitoring services
import { getConnectionStatus } from '@/lib/database/connection';

setInterval(async () => {
  const status = await getConnectionStatus();
  // Send metrics to monitoring service
}, 30000);
```