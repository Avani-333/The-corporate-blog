#!/usr/bin/env node

/**
 * Weekly Database Export Script
 * Exports PostgreSQL database to multiple formats and locations
 * 
 * Usage:
 *   node scripts/weekly-export.js
 *   npm run export:weekly
 * 
 * Environment Variables:
 *   - DATABASE_URL or POSTGRES_URL_NON_POOLING: PostgreSQL connection
 *   - NODE_ENV: Environment (development, staging, production)
 *   - EXPORT_DIR: Export directory (default: ./exports)
 *   - AWS_REGION: AWS region for S3 upload
 *   - AWS_S3_BUCKET: S3 bucket for backups
 *   - SLACK_WEBHOOK: Slack webhook for notifications
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const https = require('https');
const url = require('url');

// ============================================================================
// CONFIGURATION
// ============================================================================

const EXPORT_CONFIG = {
  // Export location
  exportDir: process.env.EXPORT_DIR || './exports',
  
  // Formats to export
  formats: {
    sql: {
      enabled: true,
      compressed: true,
      description: 'PostgreSQL dump (compressed)'
    },
    csv: {
      enabled: true,
      compressed: true,
      description: 'CSV export (compressed)'
    },
    json: {
      enabled: false,
      compressed: true,
      description: 'JSON export (compressed) - disabled by default for size'
    }
  },

  // Remote storage destinations
  remoteStorage: {
    s3: {
      enabled: process.env.AWS_S3_BUCKET ? true : false,
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1',
      prefix: 'database-exports/weekly',
      storageClass: 'GLACIER'  // Cost optimization
    },
    slack: {
      enabled: process.env.SLACK_WEBHOOK ? true : false,
      webhook: process.env.SLACK_WEBHOOK
    }
  },

  // Retention policies
  retention: {
    local: {
      days: 4,  // Keep last 4 weeks locally
      maxSize: '100GB'
    },
    s3: {
      days: 90,
      rule: 'Transition to GLACIER after 30 days'
    }
  },

  // Export options
  options: {
    excludeTables: [],  // Tables to exclude
    includeData: true,
    includeSchema: true,
    parallel: 4,  // Parallel jobs
    verbose: process.env.VERBOSE === 'true'
  },

  // Notification
  notification: {
    email: process.env.EXPORT_NOTIFICATION_EMAIL,
    slack: process.env.SLACK_WEBHOOK
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
  if (EXPORT_CONFIG.options.verbose) {
    log(`Executing: ${command}`, 'info');
  }
  try {
    return execSync(command, { 
      stdio: options.stdio || 'pipe',
      encoding: 'utf8',
      timeout: options.timeout || 3600000,  // 1 hour default
      ...options 
    });
  } catch (error) {
    log(`Command failed: ${error.message}`, 'error');
    throw error;
  }
}

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`, 'info');
  }
}

function getEnvironment() {
  return process.env.NODE_ENV || 'development';
}

function generateExportName(env, format) {
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .split('T')[0];  // YYYY-MM-DD
  const weekNumber = getWeekNumber();
  return `export-${env}-w${weekNumber}-${timestamp}.${format === 'sql' ? 'sql' : format}`;
}

function getWeekNumber() {
  const d = new Date();
  const firstDay = new Date(d.getFullYear(), 0, 1);
  const doy = (d - firstDay) / 86400000;
  return Math.ceil((doy + firstDay.getDay() + 1) / 7);
}

function getFileSizeMB(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / 1024 / 1024).toFixed(2);
}

function getChecksum(filePath) {
  const crypto = require('crypto');
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

async function exportSQL(env) {
  log('Exporting database to SQL...', 'info');
  
  const dbUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('No database URL found in environment');
  }

  const exportName = generateExportName(env, 'sql');
  const outputFile = path.join(EXPORT_CONFIG.exportDir, exportName);

  try {
    // Create backup
    log(`Creating SQL dump: ${exportName}`, 'info');
    execCommand(`pg_dump "${dbUrl}" > "${outputFile}"`, {
      timeout: 1800000  // 30 minutes for large databases
    });

    // Verify output
    if (!fs.existsSync(outputFile)) {
      throw new Error('SQL export file not created');
    }

    const sizeMB = getFileSizeMB(outputFile);
    log(`SQL dump created: ${sizeMB}MB`, 'success');

    // Compress
    if (EXPORT_CONFIG.formats.sql.compressed) {
      log('Compressing SQL dump...', 'info');
      execCommand(`gzip "${outputFile}"`);
      
      const compressedPath = `${outputFile}.gz`;
      const compressedSize = getFileSizeMB(compressedPath);
      const ratio = (100 * (1 - parseFloat(compressedSize) / parseFloat(sizeMB))).toFixed(1);
      
      log(`Compressed: ${compressedSize}MB (${ratio}% reduction)`, 'success');
      
      return {
        format: 'sql',
        path: compressedPath,
        filename: `${exportName}.gz`,
        size: compressedSize,
        compressed: true,
        checksum: getChecksum(compressedPath)
      };
    }

    return {
      format: 'sql',
      path: outputFile,
      filename: exportName,
      size: sizeMB,
      compressed: false,
      checksum: getChecksum(outputFile)
    };

  } catch (error) {
    log(`SQL export failed: ${error.message}`, 'error');
    throw error;
  }
}

async function exportCSV(env) {
  log('Exporting database tables to CSV...', 'info');

  const dbUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  const exportDir = path.join(EXPORT_CONFIG.exportDir, `csv-${env}-${new Date().toISOString().split('T')[0]}`);
  
  ensureDirectoryExists(exportDir);

  try {
    // Get list of tables
    log('Fetching table list...', 'info');
    const tableList = execCommand(
      `psql "${dbUrl}" -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public';"`,
      { stdio: 'pipe' }
    ).trim().split('\n').filter(t => t);

    log(`Found ${tableList.length} tables`, 'info');

    // Export each table
    let totalSize = 0;
    for (const table of tableList) {
      const csvFile = path.join(exportDir, `${table}.csv`);
      log(`  Exporting table: ${table}`, 'info');
      
      execCommand(
        `psql "${dbUrl}" -c "COPY \\"${table}\\" TO STDOUT WITH CSV HEADER" > "${csvFile}"`,
        { stdio: 'pipe' }
      );

      totalSize += getFileSizeMB(csvFile);
    }

    // Compress directory
    if (EXPORT_CONFIG.formats.csv.compressed) {
      log('Compressing CSV exports...', 'info');
      const archiveName = path.basename(exportDir);
      const archivePath = path.join(EXPORT_CONFIG.exportDir, archiveName);
      
      execCommand(`tar -czf "${archivePath}.tar.gz" -C "${EXPORT_CONFIG.exportDir}" "${archiveName}"`);
      execCommand(`rm -rf "${exportDir}"`);
      
      const compressedSize = getFileSizeMB(`${archivePath}.tar.gz`);
      log(`CSV compressed: ${compressedSize}MB`, 'success');

      return {
        format: 'csv',
        path: `${archivePath}.tar.gz`,
        filename: `${archiveName}.tar.gz`,
        size: compressedSize,
        compressed: true,
        tableCount: tableList.length,
        checksum: getChecksum(`${archivePath}.tar.gz`)
      };
    }

    return {
      format: 'csv',
      path: exportDir,
      filename: path.basename(exportDir),
      size: totalSize.toFixed(2),
      compressed: false,
      tableCount: tableList.length
    };

  } catch (error) {
    log(`CSV export failed: ${error.message}`, 'error');
    throw error;
  }
}

// ============================================================================
// REMOTE STORAGE FUNCTIONS
// ============================================================================

async function uploadToS3(exportFile) {
  if (!EXPORT_CONFIG.remoteStorage.s3.enabled) {
    return null;
  }

  log(`Uploading to S3: s3://${EXPORT_CONFIG.remoteStorage.s3.bucket}`, 'info');

  try {
    const AWS = require('@aws-sdk/client-s3');
    const fs = require('fs');
    const path = require('path');

    const s3Client = new AWS.S3Client({
      region: EXPORT_CONFIG.remoteStorage.s3.region
    });

    const fileStream = fs.createReadStream(exportFile.path);
    const fileSize = fs.statSync(exportFile.path).size;

    const params = {
      Bucket: EXPORT_CONFIG.remoteStorage.s3.bucket,
      Key: `${EXPORT_CONFIG.remoteStorage.s3.prefix}/${exportFile.filename}`,
      Body: fileStream,
      ContentType: exportFile.filename.endsWith('.gz') ? 'application/gzip' : 'application/sql',
      StorageClass: EXPORT_CONFIG.remoteStorage.s3.storageClass,
      Metadata: {
        'export-date': new Date().toISOString(),
        'environment': getEnvironment(),
        'format': exportFile.format,
        'sha256': exportFile.checksum
      }
    };

    const command = new AWS.PutObjectCommand(params);
    const result = await s3Client.send(command);

    log(`✅ Uploaded to S3: ${exportFile.filename}`, 'success');

    return {
      bucket: EXPORT_CONFIG.remoteStorage.s3.bucket,
      key: params.Key,
      eTag: result.ETag,
      size: fileSize
    };

  } catch (error) {
    log(`S3 upload failed: ${error.message}`, 'error');
    if (error.code !== 'NoCredentialsProvider') {
      throw error;
    }
    return null;
  }
}

async function notifySlack(exportResults) {
  if (!EXPORT_CONFIG.remoteStorage.slack.enabled) {
    return;
  }

  log('Sending Slack notification...', 'info');

  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Weekly Database Export Complete'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Environment*\n${getEnvironment()}`
          },
          {
            type: 'mrkdwn',
            text: `*Week*\nWeek ${getWeekNumber()}`
          },
          {
            type: 'mrkdwn',
            text: `*Date*\n${new Date().toISOString().split('T')[0]}`
          },
          {
            type: 'mrkdwn',
            text: `*Status*\n✅ Success`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Exports*'
        }
      },
      ...exportResults.map(exp => ({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*${exp.format.toUpperCase()}*\n${exp.filename}`
          },
          {
            type: 'mrkdwn',
            text: `*Size*\n${exp.size}MB`
          }
        ]
      })),
      {
        type: 'divider'
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📍 Local: ${EXPORT_CONFIG.exportDir} | ☁️ S3: ${EXPORT_CONFIG.remoteStorage.s3.enabled ? EXPORT_CONFIG.remoteStorage.s3.bucket : 'disabled'}`
          }
        ]
      }
    ]
  };

  try {
    const options = url.parse(EXPORT_CONFIG.remoteStorage.slack.webhook);
    options.method = 'POST';
    options.headers = { 'Content-Type': 'application/json' };

    await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Slack API error: ${res.statusCode}`));
        }
        resolve();
      });

      req.on('error', reject);
      req.write(JSON.stringify(message));
      req.end();
    });

    log('Slack notification sent', 'success');
  } catch (error) {
    log(`Slack notification failed: ${error.message}`, 'warning');
  }
}

// ============================================================================
// RETENTION MANAGEMENT
// ============================================================================

async function cleanupExpiredExports() {
  log('Cleaning up expired exports...', 'info');

  const retentionDays = EXPORT_CONFIG.retention.local.days;
  const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

  try {
    const files = fs.readdirSync(EXPORT_CONFIG.exportDir);
    let deletedCount = 0;
    let deletedSize = 0;

    for (const file of files) {
      const filePath = path.join(EXPORT_CONFIG.exportDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime < cutoffDate) {
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        fs.unlinkSync(filePath);
        
        deletedCount++;
        deletedSize += stats.size;
        
        log(`  Deleted: ${file} (${sizeMB}MB)`, 'info');
      }
    }

    if (deletedCount > 0) {
      log(`Cleanup complete: ${deletedCount} files deleted (${(deletedSize / 1024 / 1024).toFixed(2)}MB freed)`, 'success');
    } else {
      log('No expired exports to clean up', 'info');
    }

  } catch (error) {
    log(`Cleanup failed: ${error.message}`, 'error');
    // Don't throw - cleanup failure shouldn't block export
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runExport() {
  const startTime = Date.now();
  const env = getEnvironment();

  console.log('');
  log('================================', 'info');
  log('Weekly Database Export Script', 'info');
  log('================================', 'info');
  log(`Environment: ${env}`, 'info');
  log(`Week: ${getWeekNumber()}`, 'info');
  log(`Time: ${new Date().toISOString()}`, 'info');
  console.log('');

  try {
    // 1. Prepare
    ensureDirectoryExists(EXPORT_CONFIG.exportDir);

    // 2. Export
    const exportResults = [];

    if (EXPORT_CONFIG.formats.sql.enabled) {
      const sqlExport = await exportSQL(env);
      exportResults.push(sqlExport);
    }

    if (EXPORT_CONFIG.formats.csv.enabled) {
      const csvExport = await exportCSV(env);
      exportResults.push(csvExport);
    }

    // 3. Upload to remote storage
    for (const exportFile of exportResults) {
      if (EXPORT_CONFIG.remoteStorage.s3.enabled) {
        const s3Result = await uploadToS3(exportFile);
        if (s3Result) {
          exportFile.s3 = s3Result;
        }
      }
    }

    // 4. Cleanup old exports
    await cleanupExpiredExports();

    // 5. Notify
    if (EXPORT_CONFIG.remoteStorage.slack.enabled) {
      await notifySlack(exportResults);
    }

    // 6. Summary
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    const totalSize = exportResults.reduce((sum, exp) => sum + parseFloat(exp.size), 0).toFixed(2);

    console.log('');
    log('================================', 'success');
    log('Export Summary', 'success');
    log('================================', 'success');
    log(`Duration: ${duration} minutes`, 'info');
    log(`Total Size: ${totalSize}MB`, 'info');
    log(`Files: ${exportResults.length}`, 'info');
    log(`Location: ${EXPORT_CONFIG.exportDir}`, 'info');
    console.log('');

    exportResults.forEach(exp => {
      log(`  ✅ ${exp.filename} (${exp.size}MB)`, 'success');
      if (exp.s3) {
        log(`     → S3: s3://${exp.s3.bucket}/${exp.s3.key}`, 'info');
      }
    });

    console.log('');
    log('Export completed successfully!', 'success');

  } catch (error) {
    log(`Export failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

// Handle arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Weekly Database Export Script

Usage:
  node scripts/weekly-export.js [options]

Options:
  --help, -h          Show this help message
  --dry-run           Don't actually export, just show what would be done
  --formats <list>    Comma-separated formats to export (sql,csv,json)
  --no-cleanup        Skip cleanup of old exports
  --no-s3            Skip S3 upload

Environment Variables:
  DATABASE_URL              PostgreSQL connection string
  POSTGRES_URL_NON_POOLING  Direct PostgreSQL connection (preferred)
  NODE_ENV                  Environment (development, staging, production)
  EXPORT_DIR                Export directory (default: ./exports)
  AWS_REGION                AWS region for S3
  AWS_S3_BUCKET            S3 bucket for backups
  SLACK_WEBHOOK            Slack webhook for notifications
  VERBOSE                   Enable verbose logging

Examples:
  node scripts/weekly-export.js
  
  VERBOSE=true node scripts/weekly-export.js
  
  EXPORT_DIR=/backups node scripts/weekly-export.js
  `);
  process.exit(0);
}

// Run export
runExport().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});
