#!/usr/bin/env node

/**
 * Verify Production Build Security
 * 
 * Checks for:
 * - No exposed source maps
 * - No hardcoded secrets
 * - No exposed environment files
 * - Proper build configuration
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkSourceMaps() {
  const issues = [];
  const frontendMaps = new Set();
  const backendMaps = new Set();

  // Check .next directory
  const walkDir = (dir, isBackend = false) => {
    try {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      files.forEach(file => {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory() && !fullPath.includes('node_modules')) {
          walkDir(fullPath, isBackend);
        } else if (file.name.endsWith('.js.map') || file.name.endsWith('.map')) {
          if (isBackend) {
            backendMaps.add(fullPath);
          } else {
            frontendMaps.add(fullPath);
          }
        }
      });
    } catch (e) {
      // Ignore permission errors
    }
  };

  // Check frontend
  if (fs.existsSync('.next')) {
    walkDir('.next', false);
  }

  // Check backend
  if (fs.existsSync('dist')) {
    walkDir('dist', true);
  }

  if (frontendMaps.size > 0) {
    issues.push({
      severity: 'critical',
      type: 'Frontend Source Maps',
      count: frontendMaps.size,
      files: Array.from(frontendMaps),
      message: `Found ${frontendMaps.size} frontend source maps - these expose internal code structure`
    });
  }

  if (backendMaps.size > 0) {
    issues.push({
      severity: 'critical',
      type: 'Backend Source Maps',
      count: backendMaps.size,
      files: Array.from(backendMaps),
      message: `Found ${backendMaps.size} backend source maps - these expose internal code structure`
    });
  }

  return issues;
}

function checkExposedEnv() {
  const exposedFiles = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.production.local',
  ];

  const found = exposedFiles.filter(f => fs.existsSync(f));

  if (found.length > 0) {
    return [{
      severity: 'critical',
      type: 'Exposed Environment Files',
      count: found.length,
      files: found,
      message: `Found exposed environment files: ${found.join(', ')}`
    }];
  }

  return [];
}

function checkHardcodedSecrets() {
  const secretPatterns = [
    { regex: /JWT_SECRET\s*=\s*['"][^'"]+['"]/i, name: 'JWT_SECRET' },
    { regex: /REFRESH_SECRET\s*=\s*['"][^'"]+['"]/i, name: 'REFRESH_SECRET' },
    { regex: /API_KEY\s*=\s*['"][^'"]+['"]/i, name: 'API_KEY' },
    { regex: /CLIENT_SECRET\s*=\s*['"][^'"]+['"]/i, name: 'CLIENT_SECRET' },
    { regex: /PASSWORD\s*=\s*['"][^'"]+['"]/i, name: 'PASSWORD' },
  ];

  const foundSecrets = new Map();

  const checkFiles = (dir) => {
    try {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      files.forEach(file => {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory() && !fullPath.includes('node_modules') && !fullPath.includes('.next') && !fullPath.includes('dist')) {
          checkFiles(fullPath);
        } else if ((file.name.endsWith('.ts') || file.name.endsWith('.js')) && !fullPath.includes('node_modules')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            secretPatterns.forEach(({ regex, name }) => {
              if (regex.test(content)) {
                if (!foundSecrets.has(name)) {
                  foundSecrets.set(name, []);
                }
                foundSecrets.get(name).push(fullPath);
              }
            });
          } catch (e) {
            // Ignore read errors
          }
        }
      });
    } catch (e) {
      // Ignore permission errors
    }
  };

  checkFiles('src');
  checkFiles('app');
  checkFiles('lib');

  if (foundSecrets.size > 0) {
    return [{
      severity: 'critical',
      type: 'Hardcoded Secrets',
      count: foundSecrets.size,
      secrets: Object.fromEntries(foundSecrets),
      message: `Found ${foundSecrets.size} hardcoded secret patterns`
    }];
  }

  return [];
}

function checkNextConfig() {
  const issues = [];

  try {
    const content = fs.readFileSync('next.config.js', 'utf8');

    if (!content.includes('productionBrowserSourceMaps: false')) {
      issues.push({
        severity: 'high',
        type: 'Next.js Config',
        message: 'Missing "productionBrowserSourceMaps: false" - source maps will be generated in production'
      });
    }

    if (!content.includes('withSentryConfig')) {
      issues.push({
        severity: 'medium',
        type: 'Next.js Config',
        message: 'Sentry integration not found - error tracking may not work properly'
      });
    }
  } catch (e) {
    // Ignore if file doesn't exist
  }

  return issues;
}

function checkBackendTsConfig() {
  const issues = [];

  try {
    const content = fs.readFileSync('backend/tsconfig.json', 'utf8');
    const config = JSON.parse(content);

    if (config.compilerOptions.sourceMap === true) {
      issues.push({
        severity: 'high',
        type: 'Backend TypeScript Config',
        message: 'Source maps enabled in backend - these will expose internal code. Use tsconfig.prod.json for production builds'
      });
    }
  } catch (e) {
    // Ignore if file doesn't exist
  }

  return issues;
}

function generateReport(allIssues) {
  const critical = allIssues.filter(i => i.severity === 'critical');
  const high = allIssues.filter(i => i.severity === 'high');
  const medium = allIssues.filter(i => i.severity === 'medium');

  console.log('\n' + '='.repeat(80));
  log(colors.blue, '🔍 PRODUCTION BUILD SECURITY VERIFICATION REPORT');
  console.log('='.repeat(80) + '\n');

  if (critical.length > 0) {
    log(colors.red, '🔴 CRITICAL ISSUES (Must Fix):');
    critical.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. ${issue.type}`);
      console.log(`   Message: ${issue.message}`);
      if (issue.files && issue.files.length > 0) {
        console.log(`   Files: ${issue.files.slice(0, 3).join(', ')}${issue.files.length > 3 ? ` (+${issue.files.length - 3} more)` : ''}`);
      }
      if (issue.secrets) {
        console.log(`   Secrets: ${Object.keys(issue.secrets).join(', ')}`);
      }
    });
  }

  if (high.length > 0) {
    log(colors.yellow, '\n🟠 HIGH ISSUES (Should Fix):');
    high.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. ${issue.type}`);
      console.log(`   Message: ${issue.message}`);
    });
  }

  if (medium.length > 0) {
    log(colors.yellow, '\n🟡 MEDIUM ISSUES (Consider Fixing):');
    medium.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. ${issue.type}`);
      console.log(`   Message: ${issue.message}`);
    });
  }

  if (allIssues.length === 0) {
    log(colors.green, '✅ All security checks passed!');
  }

  console.log('\n' + '='.repeat(80));
  log(colors.blue, `📊 SUMMARY: ${critical.length} critical, ${high.length} high, ${medium.length} medium`);
  console.log('='.repeat(80) + '\n');

  return {
    critical: critical.length,
    high: high.length,
    medium: medium.length,
    total: allIssues.length
  };
}

function main() {
  const allIssues = [
    ...checkSourceMaps(),
    ...checkExposedEnv(),
    ...checkHardcodedSecrets(),
    ...checkNextConfig(),
    ...checkBackendTsConfig(),
  ];

  const summary = generateReport(allIssues);

  if (summary.critical > 0) {
    log(colors.red, '❌ FAILED: Critical security issues found before deploying!');
    process.exit(1);
  }

  if (summary.high > 0) {
    log(colors.yellow, '⚠️ WARNING: High-severity issues found. Review before deploying.');
    process.exit(0);
  }

  log(colors.green, '✅ PASSED: Build passed security checks. Safe to deploy.');
  process.exit(0);
}

main();
