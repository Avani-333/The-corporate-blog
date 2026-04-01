# Database Infrastructure Setup

## 🎯 Overview

The Corporate Blog now features a production-grade database infrastructure with:

- **Advanced Connection Pooling** with environment-specific configurations
- **Comprehensive Migration Pipeline** with backup/restore capabilities  
- **Health Monitoring** with real-time connection status tracking
- **Docker Integration** with PostgreSQL, PgBouncer, and Redis
- **Automated Backups** with retention policies and integrity verification

## 🚀 Quick Setup

### 1. Docker Environment (Recommended)

```bash
# Start database services
docker-compose up -d postgres pgbouncer redis

# Wait for services to be ready (30 seconds)
sleep 30

# Setup database schema and seed data
npm run db:setup

# Verify health
npm run db:health-check
```

### 2. Local Environment

```bash
# Copy environment configuration
cp .env.example .env.local

# Configure your database URLs in .env.local
# POSTGRES_PRISMA_URL=postgresql://user:pass@host:5432/db?pgbouncer=true
# POSTGRES_URL_NON_POOLING=postgresql://user:pass@host:5432/db

# Setup database
npm run db:setup
```

## 📊 Connection Pooling Configuration

### Environment-Specific Settings

| Environment | Connections | Timeouts | SSL | Monitoring |
|-------------|-------------|----------|-----|------------|
| Production  | 25 max      | 30s      | Required | Full |
| Development | 5 max       | 10s      | Optional | Minimal |
| Test        | 2 max       | 5s       | Disabled | None |

### Configuration Files

- `lib/database/connection.ts` - Main database connection with monitoring
- `config/url-config.ts` - Environment-specific configurations
- `.env.production.example` - Production environment template
- `.env.test.example` - Test environment template

## 🔄 Migration Pipeline Commands

### Core Migration Commands

```bash
# Status and validation
npm run migrate:status          # Check migration status
npm run migrate:validate        # Validate schema and migrations

# Migration operations
npm run migrate:generate "name" # Generate new migration
npm run migrate:apply          # Apply pending migrations  
npm run migrate:rollback       # Rollback last migration
npm run migrate:reset          # Reset entire database

# Backup and restore
npm run migrate:backup         # Create database backup
npm run migrate:restore <file> # Restore from backup

# Health monitoring
npm run db:health-check        # Single health check
npm run db:monitor            # Continuous monitoring
```

### Advanced Script Usage

```bash
# Direct script access for advanced options
node scripts/migrate.js backup
node scripts/migrate.js rollback 2
node scripts/migrate.js restore backups/backup-prod-2024-03-07.sql.gz
```

## 📁 Project Structure

```
├── lib/database/
│   └── connection.ts          # Database connection with pooling
├── scripts/
│   ├── migrate.js            # Migration pipeline script
│   ├── init-db.sh           # Database initialization
│   └── backup-cron.sh       # Automated backup script
├── app/api/health/
│   └── database/route.ts    # Health check API endpoint
├── docs/
│   ├── database-migration-guide.md
│   └── url-conventions.md
├── docker-compose.yml       # Docker services configuration
├── .env.production.example  # Production environment template
├── .env.test.example       # Test environment template
└── package.json            # Updated with migration scripts
```

## 🔧 Docker Services

### Included Services

- **PostgreSQL 15** - Primary database with development/test/staging databases
- **PgBouncer** - Connection pooling proxy (port 6432)
- **Redis** - Caching layer (optional)
- **PgAdmin** - Database administration interface (port 5050)
- **Automated Backups** - Daily backup service with retention

### Service Commands

```bash
# Start all services  
docker-compose up -d

# Start with development tools
docker-compose --profile dev up -d

# Start with backup service
docker-compose --profile backup up -d

# View logs
docker-compose logs -f postgres
docker-compose logs -f pgbouncer

# Stop services
docker-compose down
```

## 📈 Monitoring & Health Checks

### API Endpoints

- `GET /api/health/database` - Comprehensive health status
- `HEAD /api/health/database` - Simple health check for load balancers

### Health Check Response

```json
{
  "status": "healthy|unhealthy",
  "checks": {
    "database": {
      "status": "connected",
      "latency": 45,
      "environment": "production", 
      "config": { "connectionLimit": 25 },
      "stats": {
        "activeConnections": 3,
        "queriesRun": 1250,
        "averageQueryTime": 125,
        "slowQueries": 2
      }
    },
    "timestamp": "2024-03-07T10:30:00.000Z"
  }
}
```

### Monitoring Integration

```typescript
// Real-time monitoring
import { getConnectionStatus } from '@/lib/database/connection';

const status = await getConnectionStatus();
console.log('Database Status:', status);
```

## 🔒 Security Features

- **SSL/TLS encryption** in production environments
- **Connection limits** prevent resource exhaustion  
- **Query timeouts** prevent long-running queries
- **Backup encryption** with secure storage
- **Environment isolation** with separate configurations

## 🚨 Troubleshooting

### Common Issues

**Connection Pool Exhausted**
```bash
npm run db:health-check  # Check status
npm run db:monitor       # Monitor connections
# Restart application to reset pool
```

**Migration Conflicts**
```bash
npm run migrate:status   # Check status
npm run migrate:validate # Validate schema
# Manual resolution may be required
```

**Performance Issues**
```bash
# Check slow queries in application logs
# Monitor connection metrics via health endpoint
# Consider adjusting connection limits
```

### Recovery Procedures

**Migration Failure Recovery**
```bash
# Restore from automatic backup
npm run migrate:restore <latest-backup>
# Fix migration issues and retry
```

**Connection Issues**
```bash
# Check database server status
docker-compose ps
# Verify environment configuration
# Check SSL settings and credentials
```

## 📚 Additional Resources

- [Database Migration Pipeline Guide](docs/database-migration-guide.md)
- [URL Conventions & Slug Standards](docs/url-conventions.md)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [PgBouncer Configuration](https://www.pgbouncer.org/)

## ✅ Production Checklist

Before deploying to production:

- [ ] Configure production database URLs with SSL
- [ ] Set up connection pooling with appropriate limits
- [ ] Enable monitoring and health checks
- [ ] Configure automated backups
- [ ] Test migration and rollback procedures  
- [ ] Verify SSL/TLS configuration
- [ ] Set up monitoring alerts
- [ ] Document recovery procedures

---

**Status**: ✅ Database pooling and migration pipeline fully configured and operational.

**Next Steps**: Ready for production deployment with comprehensive database infrastructure.