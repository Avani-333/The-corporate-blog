#!/usr/bin/env node

/**
 * Export Manager CLI
 * Manage database exports from the command line
 * 
 * Usage:
 *   npm run export:manage -- [command] [options]
 *   node scripts/export-manager.js [command] [options]
 * 
 * Commands:
 *   trigger      Trigger a new export on backend
 *   status       Check status of export job
 *   list         List recent exports
 *   delete       Delete a specific export
 *   cleanup      Delete expired exports
 */

const https = require('https');
const http = require('http');
const url = require('url');
const fs = require('fs');
const chalk = require('chalk');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const API_KEY = process.env.EXPORT_API_KEY || '';

// ============================================================================
// UTILITIES
// ============================================================================

function log(message, type = 'info') {
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
  };
  console.log(colors[type](message));
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(path, BACKEND_URL);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-export-key': API_KEY,
      },
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// ============================================================================
// COMMANDS
// ============================================================================

async function trigger(args) {
  const options = {
    formats: 'sql,csv',
    dryRun: false,
    includeCleanup: true,
  };

  // Parse args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--formats' && i + 1 < args.length) {
      options.formats = args[++i];
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--no-cleanup') {
      options.includeCleanup = false;
    }
  }

  try {
    log('Triggering export...', 'info');
    const result = await request('POST', '/api/admin/export', options);

    log(`✅ Export triggered`, 'success');
    log(`Job ID: ${result.jobId}`, 'info');
    log(`Status URL: ${result.statusUrl}`, 'info');
    log(`\nCheck status with: npm run export:manage -- status ${result.jobId}`, 'info');
  } catch (error) {
    log(`❌ Failed to trigger export: ${error.message}`, 'error');
    process.exit(1);
  }
}

async function status(args) {
  const jobId = args[0];

  if (!jobId) {
    log('Usage: export-manager status <jobId>', 'error');
    process.exit(1);
  }

  try {
    const result = await request('GET', `/api/admin/export/status/${jobId}`);

    console.log('');
    log(`Job ID: ${result.jobId}`, 'info');
    log(`Status: ${result.status}`, result.status === 'completed' ? 'success' : result.status === 'running' ? 'warning' : 'error');
    log(`Started: ${result.started}`, 'info');

    if (result.completed) {
      log(`Completed: ${result.completed}`, 'info');
      log(`Duration: ${result.duration}`, 'info');
      log(`Exit Code: ${result.exitCode}`, result.exitCode === 0 ? 'success' : 'error');
    }

    if (result.output) {
      console.log('');
      log('Last Output:', 'info');
      console.log(result.output);
    }

    if (result.error) {
      console.log('');
      log('Error Output:', 'error');
      console.log(result.error);
    }
  } catch (error) {
    log(`❌ Failed to get status: ${error.message}`, 'error');
    process.exit(1);
  }
}

async function list(args) {
  try {
    const result = await request('GET', '/api/admin/export/list');

    console.log('');
    log(`Recent Exports (${result.count} files, ${result.total} total)`, 'success');
    console.log('');

    if (result.exports.length === 0) {
      log('No exports found', 'info');
      return;
    }

    console.table(result.exports.map(exp => ({
      'Filename': exp.filename,
      'Size': exp.size,
      'Modified': new Date(exp.modified).toLocaleString(),
    })));
  } catch (error) {
    log(`❌ Failed to list exports: ${error.message}`, 'error');
    process.exit(1);
  }
}

async function deleteExport(args) {
  const filename = args[0];

  if (!filename) {
    log('Usage: export-manager delete <filename>', 'error');
    process.exit(1);
  }

  // Confirm
  console.log('');
  log(`⚠️  This will delete: ${filename}`, 'warning');

  try {
    const result = await request('DELETE', `/api/admin/export/${filename}`);

    log(`✅ ${result.message}`, 'success');
  } catch (error) {
    log(`❌ Failed to delete export: ${error.message}`, 'error');
    process.exit(1);
  }
}

async function cleanup(args) {
  try {
    log('Starting cleanup...', 'info');

    const result = await request('POST', '/api/admin/export/cleanup', {
      dryRun: args.includes('--dry-run'),
    });

    if (result.success) {
      log(`✅ Cleanup complete`, 'success');
      log(`Files deleted: ${result.deletedCount}`, 'info');
      log(`Space freed: ${result.freedSpace}`, 'info');
    }
  } catch (error) {
    if (error.message.includes('404')) {
      log('Cleanup endpoint not available', 'warning');
    } else {
      log(`❌ Cleanup failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// ============================================================================
// HELP
// ============================================================================

function showHelp() {
  console.log(`
Export Manager CLI

Usage:
  npm run export:manage -- [command] [options]
  node scripts/export-manager.js [command] [options]

Commands:
  trigger          Trigger a new export
    --formats      Formats to export: sql,csv,json (default: sql,csv)
    --dry-run      Show what would be exported without doing it
    --no-cleanup   Skip cleanup of old exports

  status <jobId>   Check status of export job

  list             List recent exports

  delete <file>    Delete a specific export

  cleanup          Delete expired exports (if available)
    --dry-run      Show what would be deleted

  help, -h, --help Show this help message

Environment Variables:
  BACKEND_URL      Backend server URL (default: http://localhost:5000)
  EXPORT_API_KEY   API key for authentication

Examples:
  # Trigger export
  npm run export:manage -- trigger

  # Check status
  npm run export:manage -- status export-1712090400000

  # List exports
  npm run export:manage -- list

  # Delete an export
  npm run export:manage -- delete export-prod-w14-2026-04-01.sql.gz

  # Trigger dry-run
  npm run export:manage -- trigger --dry-run
  `);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '-h' || command === '--help') {
    showHelp();
    process.exit(0);
  }

  if (!API_KEY) {
    log('⚠️  EXPORT_API_KEY environment variable not set', 'warning');
    log('Some operations may fail due to authentication', 'warning');
  }

  try {
    switch (command) {
      case 'trigger':
        await trigger(args.slice(1));
        break;
      case 'status':
        await status(args.slice(1));
        break;
      case 'list':
        await list(args.slice(1));
        break;
      case 'delete':
        await deleteExport(args.slice(1));
        break;
      case 'cleanup':
        await cleanup(args.slice(1));
        break;
      default:
        log(`Unknown command: ${command}`, 'error');
        log('Use "help" for usage information', 'info');
        process.exit(1);
    }
  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
