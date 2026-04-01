#!/bin/bash

# Database Initialization Script
# Runs when PostgreSQL container starts for the first time

set -e

echo "🚀 Initializing The Corporate Blog database..."

# Create additional databases for different environments
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create test database
    CREATE DATABASE thecorporateblog_test;
    
    -- Create staging database  
    CREATE DATABASE thecorporateblog_staging;
    
    -- Grant permissions
    GRANT ALL PRIVILEGES ON DATABASE thecorporateblog_test TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE thecorporateblog_staging TO $POSTGRES_USER;
    
    -- Create extensions for main database
    \\c $POSTGRES_DB;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "citext";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    CREATE EXTENSION IF NOT EXISTS "btree_gin";
    
    -- Create extensions for test database
    \\c thecorporateblog_test;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "citext"; 
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    CREATE EXTENSION IF NOT EXISTS "btree_gin";
    
    -- Create extensions for staging database
    \\c thecorporateblog_staging;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "citext";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    CREATE EXTENSION IF NOT EXISTS "btree_gin";
EOSQL

echo "✅ Database initialization completed!"

# Create backup directory with proper permissions
mkdir -p /backups
chmod 755 /backups

echo "✅ Backup directory created!"

# Set up performance optimizations
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Performance optimizations for development
    ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
    ALTER SYSTEM SET pg_stat_statements.track = all;
    ALTER SYSTEM SET log_statement = 'all';
    ALTER SYSTEM SET log_min_duration_statement = 1000;
    ALTER SYSTEM SET log_checkpoints = on;
    ALTER SYSTEM SET log_connections = on;
    ALTER SYSTEM SET log_disconnections = on;
    ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
EOSQL

echo "✅ Performance configuration applied!"

# Display connection information
echo "
🎉 The Corporate Blog Database Setup Complete!

📊 Database Information:
   Main Database: $POSTGRES_DB
   Test Database: thecorporateblog_test
   Staging Database: thecorporateblog_staging
   User: $POSTGRES_USER

🔌 Connection Details:
   Direct Connection: postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB
   Pooled Connection: postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:6432/$POSTGRES_DB
   
📈 Monitoring:
   Extensions installed: uuid-ossp, citext, pg_trgm, btree_gin
   Statement logging enabled for queries > 1000ms
   
🚀 Next Steps:
   1. Run: npm run db:setup
   2. Run: npm run migrate:apply
   3. Run: npm run db:seed
   
🔧 Admin Access:
   PgAdmin: http://localhost:5050 (admin@thecorporateblog.com / admin)
"