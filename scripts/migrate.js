#!/usr/bin/env node

/**
 * Database Migration Pipeline
 * Comprehensive migration management for The Corporate Blog
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// ============================================================================
// CONFIGURATION
// ============================================================================

const MIGRATION_CONFIG = {
  environments: {
    development: {
      requiresConfirmation: false,
      allowDestructive: true,
      backupBeforeMigration: false,
      runSeeds: true,
    },
    staging: {
      requiresConfirmation: true,
      allowDestructive: true,
      backupBeforeMigration: true,
      runSeeds: true,
    },
    production: {
      requiresConfirmation: true,
      allowDestructive: false,
      backupBeforeMigration: true,
      runSeeds: false,
    },
  },
  
  backup: {
    directory: './backups',
    maxBackups: 10,
    compressionLevel: 9,
  },
  
  migration: {
    timeout: 300000, // 5 minutes
    maxParallel: 1,  // Sequential migrations for safety
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
  };
  
  console.log(`[${timestamp}] ${colors[type](message)}`);
}

function execCommand(command, options = {}) {
  log(`Executing: ${command}`, 'info');
  try {
    return execSync(command, { 
      stdio: 'inherit', 
      encoding: 'utf8',
      timeout: MIGRATION_CONFIG.migration.timeout,
      ...options 
    });
  } catch (error) {
    log(`Command failed: ${error.message}`, 'error');
    throw error;
  }
}

function getEnvironment() {
  return process.env.NODE_ENV || 'development';
}

function getEnvironmentConfig() {
  const env = getEnvironment();
  return MIGRATION_CONFIG.environments[env] || MIGRATION_CONFIG.environments.development;
}

async function confirmAction(message) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    readline.question(`${chalk.yellow(message)} (y/N): `, (answer) => {
      readline.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`, 'info');
  }
}

// ============================================================================
// BACKUP FUNCTIONS
// ============================================================================

function generateBackupName() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const env = getEnvironment();
  return `backup-${env}-${timestamp}.sql`;
}

async function createBackup() {
  const config = getEnvironmentConfig();
  
  if (!config.backupBeforeMigration) {
    log('Backup skipped for this environment', 'info');
    return null;
  }

  ensureDirectoryExists(MIGRATION_CONFIG.backup.directory);
  
  const backupFile = path.join(MIGRATION_CONFIG.backup.directory, generateBackupName());
  const dbUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    throw new Error('No database URL found in environment variables');
  }

  log('Creating database backup...', 'info');
  
  try {
    // Use pg_dump for PostgreSQL backup
    execCommand(`pg_dump "${dbUrl}" > "${backupFile}"`);
    log(`Backup created: ${backupFile}`, 'success');
    
    // Compress backup
    execCommand(`gzip "${backupFile}"`);
    log(`Backup compressed: ${backupFile}.gz`, 'success');
    
    // Clean up old backups
    await cleanupOldBackups();
    
    return `${backupFile}.gz`;
  } catch (error) {
    log(`Backup failed: ${error.message}`, 'error');
    throw error;
  }
}

async function cleanupOldBackups() {
  const backupDir = MIGRATION_CONFIG.backup.directory;
  const maxBackups = MIGRATION_CONFIG.backup.maxBackups;
  
  try {
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('backup-') && file.endsWith('.sql.gz'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        stat: fs.statSync(path.join(backupDir, file))
      }))
      .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

    if (files.length <= maxBackups) {
      return;
    }

    const filesToDelete = files.slice(maxBackups);
    
    for (const file of filesToDelete) {
      fs.unlinkSync(file.path);
      log(`Deleted old backup: ${file.name}`, 'info');
    }
  } catch (error) {
    log(`Error cleaning up backups: ${error.message}`, 'warning');
  }
}

async function restoreBackup(backupPath) {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const dbUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    throw new Error('No database URL found in environment variables');
  }

  log(`Restoring backup: ${backupPath}`, 'info');
  
  try {
    // Uncompress if needed
    let restoreFile = backupPath;
    if (backupPath.endsWith('.gz')) {
      execCommand(`gunzip -c "${backupPath}" > "${backupPath.replace('.gz', '')}"`);
      restoreFile = backupPath.replace('.gz', '');
    }
    
    // Restore database
    execCommand(`psql "${dbUrl}" < "${restoreFile}"`);
    
    // Clean up temporary file
    if (restoreFile !== backupPath) {
      fs.unlinkSync(restoreFile);
    }
    
    log('Backup restored successfully', 'success');
  } catch (error) {
    log(`Restore failed: ${error.message}`, 'error');
    throw error;
  }
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

async function checkMigrationStatus() {
  log('Checking migration status...', 'info');
  
  try {
    execCommand('npx prisma migrate status', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

async function generateMigration(name) {
  if (!name) {
    throw new Error('Migration name is required');
  }

  log(`Generating migration: ${name}`, 'info');
  
  try {
    execCommand(`npx prisma migrate dev --name "${name}" --create-only`);
    log('Migration generated successfully', 'success');
  } catch (error) {
    log(`Migration generation failed: ${error.message}`, 'error');
    throw error;
  }
}

async function applyMigrations() {
  const config = getEnvironmentConfig();
  const env = getEnvironment();
  
  log(`Applying migrations for ${env} environment`, 'info');
  
  // Confirmation for non-development environments
  if (config.requiresConfirmation) {
    const confirmed = await confirmAction(
      `Are you sure you want to apply migrations to ${env}?`
    );
    
    if (!confirmed) {
      log('Migration cancelled by user', 'warning');
      return false;
    }
  }

  // Create backup if required
  if (config.backupBeforeMigration) {
    await createBackup();
  }

  try {
    // Apply migrations
    if (env === 'production' || env === 'staging') {
      execCommand('npx prisma migrate deploy');
    } else {
      execCommand('npx prisma migrate dev');
    }
    
    // Run seeds if configured
    if (config.runSeeds) {
      await runSeeds();
    }
    
    log('Migrations applied successfully', 'success');
    return true;
  } catch (error) {
    log(`Migration failed: ${error.message}`, 'error');
    throw error;
  }
}

async function rollbackMigrations(steps = 1) {
  const config = getEnvironmentConfig();
  const env = getEnvironment();
  
  if (!config.allowDestructive) {
    throw new Error(`Destructive operations not allowed in ${env} environment`);
  }

  log(`Rolling back ${steps} migration(s) in ${env}`, 'warning');
  
  const confirmed = await confirmAction(
    `This will rollback ${steps} migration(s). This operation cannot be undone. Continue?`
  );
  
  if (!confirmed) {
    log('Rollback cancelled by user', 'warning');
    return false;
  }

  try {
    // Create backup before rollback
    await createBackup();
    
    // Note: Prisma doesn't have built-in rollback, so we need to handle manually
    log('Manual rollback required - please check migration files', 'warning');
    log('Consider using backup restoration if needed', 'info');
    
    return true;
  } catch (error) {
    log(`Rollback failed: ${error.message}`, 'error');
    throw error;
  }
}

async function resetDatabase() {
  const config = getEnvironmentConfig();
  const env = getEnvironment();
  
  if (!config.allowDestructive) {
    throw new Error(`Destructive operations not allowed in ${env} environment`);
  }

  log(`Resetting database in ${env}`, 'warning');
  
  const confirmed = await confirmAction(
    'This will completely reset the database. All data will be lost. Continue?'
  );
  
  if (!confirmed) {
    log('Reset cancelled by user', 'warning');
    return false;
  }

  try {
    // Create backup before reset
    if (env !== 'development') {
      await createBackup();
    }
    
    // Reset database
    execCommand('npx prisma migrate reset --force');
    
    log('Database reset successfully', 'success');
    return true;
  } catch (error) {
    log(`Database reset failed: ${error.message}`, 'error');
    throw error;
  }
}

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

async function runSeeds() {
  log('Running database seeds...', 'info');
  
  try {
    execCommand('npm run db:seed');
    log('Seeds applied successfully', 'success');
  } catch (error) {
    log(`Seeding failed: ${error.message}`, 'error');
    throw error;
  }
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

async function validateSchema() {
  log('Validating Prisma schema...', 'info');
  
  try {
    execCommand('npx prisma validate');
    log('Schema validation passed', 'success');
    return true;
  } catch (error) {
    log('Schema validation failed', 'error');
    return false;
  }
}

async function validateMigrations() {
  log('Validating migration state...', 'info');
  
  try {
    execCommand('npx prisma migrate status');
    log('Migration validation passed', 'success');
    return true;
  } catch (error) {
    log('Migration validation failed', 'error');
    return false;
  }
}

// ============================================================================
// MAIN CLI INTERFACE
// ============================================================================

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  try {
    switch (command) {
      case 'status':
        await checkMigrationStatus();
        break;
        
      case 'generate':
        await generateMigration(args[0]);
        break;
        
      case 'apply':
        await applyMigrations();
        break;
        
      case 'rollback':
        await rollbackMigrations(parseInt(args[0]) || 1);
        break;
        
      case 'reset':
        await resetDatabase();
        break;
        
      case 'backup':
        await createBackup();
        break;
        
      case 'restore':
        await restoreBackup(args[0]);
        break;
        
      case 'seed':
        await runSeeds();
        break;
        
      case 'validate':
        const schemaValid = await validateSchema();
        const migrationsValid = await validateMigrations();
        
        if (schemaValid && migrationsValid) {
          log('All validations passed', 'success');
          process.exit(0);
        } else {
          log('Validation failed', 'error');
          process.exit(1);
        }
        break;
        
      default:
        console.log(chalk.cyan(`
Database Migration Pipeline

Usage: node scripts/migrate.js <command> [options]

Commands:
  status                    Check current migration status
  generate <name>           Generate a new migration
  apply                     Apply pending migrations
  rollback [steps]          Rollback migrations (default: 1 step)
  reset                     Reset database completely
  backup                    Create database backup
  restore <backup-file>     Restore from backup
  seed                      Run database seeds
  validate                  Validate schema and migrations

Environment: ${getEnvironment()}
        `));
    }
  } catch (error) {
    log(`Command failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run CLI
if (require.main === module) {
  main();
}

module.exports = {
  createBackup,
  restoreBackup,
  applyMigrations,
  rollbackMigrations,
  resetDatabase,
  runSeeds,
  validateSchema,
  validateMigrations
};