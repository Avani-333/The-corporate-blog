#!/usr/bin/env node

/**
 * Secrets Management Script for The Corporate Blog
 * Handles environment variable validation and secret generation
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Required environment variables by category
const REQUIRED_VARS = {
  database: [
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL_NON_POOLING'
  ],
  auth: [
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'JWT_SECRET'
  ],
  cloudinary: [
    'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY', 
    'CLOUDINARY_API_SECRET'
  ],
  site: [
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_SITE_NAME'
  ]
};

const OPTIONAL_VARS = {
  oauth: [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ],
  analytics: [
    'NEXT_PUBLIC_GA_ID',
    'NEXT_PUBLIC_VERCEL_ANALYTICS_ID'
  ],
  monitoring: [
    'SENTRY_DSN',
    'NEXT_PUBLIC_SENTRY_DSN'
  ],
  email: [
    'SMTP_HOST',
    'SMTP_PORT', 
    'SMTP_USER',
    'SMTP_PASSWORD'
  ],
  redis: [
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN'
  ]
};

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

function generateSecrets() {
  console.log(`\n${colors.magenta}Generating new secrets...${colors.reset}`);
  
  const secrets = {
    NEXTAUTH_SECRET: generateSecret(32),
    JWT_SECRET: generateSecret(32), 
    CSP_NONCE_SECRET: generateSecret(24),
    SESSION_SECRET: generateSecret(32),
    ENCRYPTION_KEY: generateSecret(32)
  };
  
  console.log(`\n${colors.yellow}Copy these to your .env.local:${colors.reset}`);
  Object.entries(secrets).forEach(([key, value]) => {
    console.log(`${colors.green}${key}${colors.reset}="${value}"`);
  });
  
  return secrets;
}

function validateEnvironment() {
  console.log(`\n${colors.magenta}Validating environment variables...${colors.reset}`);
  
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log(`${colors.red}✗ .env.local not found${colors.reset}`);
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  // Parse environment variables
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#\s][^=]*?)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    }
  });
  
  let allValid = true;
  const missing = [];
  
  // Check required variables
  Object.entries(REQUIRED_VARS).forEach(([category, vars]) => {
    console.log(`\n${colors.cyan}${category.toUpperCase()}:${colors.reset}`);
    
    vars.forEach(varName => {
      if (envVars[varName] && envVars[varName] !== 'your-value-here') {
        console.log(`  ${colors.green}✓ ${varName}${colors.reset}`);
      } else {
        console.log(`  ${colors.red}✗ ${varName} (missing or placeholder)${colors.reset}`);
        missing.push(varName);
        allValid = false;
      }
    });
  });
  
  // Check optional variables  
  console.log(`\n${colors.cyan}OPTIONAL FEATURES:${colors.reset}`);
  Object.entries(OPTIONAL_VARS).forEach(([category, vars]) => {
    const categoryComplete = vars.every(v => envVars[v] && envVars[v] !== 'your-value-here');
    const status = categoryComplete ? colors.green + '✓' : colors.yellow + '○';
    console.log(`  ${status} ${category.toUpperCase()}${colors.reset}`);
  });
  
  if (!allValid) {
    console.log(`\n${colors.red}Missing required variables:${colors.reset}`);
    missing.forEach(varName => {
      console.log(`  - ${varName}`);
    });
  }
  
  return allValid;
}

function generateVercelSecrets() {
  console.log(`\n${colors.magenta}Generating Vercel environment variable commands...${colors.reset}`);
  
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log(`${colors.red}✗ .env.local not found${colors.reset}`);
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const commands = [];
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#\s][^=]*?)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (value.trim() && !value.trim().startsWith('your-')) {
        const cleanValue = value.trim().replace(/^["']|["']$/g, '');
        commands.push(`vercel env add ${key.trim()} production`);
      }
    }
  });
  
  console.log(`\n${colors.yellow}Run these commands to set Vercel environment variables:${colors.reset}`);
  commands.forEach(cmd => {
    console.log(`${colors.cyan}${cmd}${colors.reset}`);
  });
  
  console.log(`\n${colors.yellow}Or bulk set via Vercel dashboard:${colors.reset}`);
  console.log(`${colors.blue}https://vercel.com/dashboard → Project → Settings → Environment Variables${colors.reset}`);
}

function checkDatabaseConnection() {
  console.log(`\n${colors.magenta}Database Connection Test${colors.reset}`);
  
  try {
    // This would require Prisma to be set up
    console.log(`${colors.yellow}To test database connection, run:${colors.reset}`);
    console.log(`${colors.cyan}npx prisma db push --preview-feature${colors.reset}`);
    console.log(`${colors.cyan}npx prisma studio${colors.reset}`);
  } catch (error) {
    console.log(`${colors.red}✗ Database connection test failed${colors.reset}`);
  }
}

function generateCloudinaryPresets() {
  console.log(`\n${colors.magenta}Cloudinary Upload Presets Configuration${colors.reset}`);
  
  const presets = [
    {
      name: 'blog_featured_images',
      settings: {
        folder: 'blog/featured',
        format: 'auto',
        quality: 'auto:good',
        transformation: 'c_fill,w_1200,h_630,g_center'
      }
    },
    {
      name: 'blog_content_images', 
      settings: {
        folder: 'blog/content',
        format: 'auto',
        quality: 'auto:good',
        transformation: 'c_limit,w_1000'
      }
    },
    {
      name: 'user_avatars',
      settings: {
        folder: 'users/avatars',
        format: 'auto', 
        quality: 'auto:good',
        transformation: 'c_fill,w_200,h_200,g_face'
      }
    }
  ];
  
  console.log(`\n${colors.yellow}Create these upload presets in Cloudinary:${colors.reset}`);
  presets.forEach(preset => {
    console.log(`\n${colors.cyan}${preset.name}:${colors.reset}`);
    Object.entries(preset.settings).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  });
}

function displaySecurityChecklist() {
  console.log(`\n${colors.magenta}Security Checklist${colors.reset}`);
  
  const checks = [
    '🔐 All secrets are randomly generated (32+ characters)',
    '🛡️ NEXTAUTH_URL matches your production domain',
    '🔒 Database connections use SSL (sslmode=require)',
    '🌐 CORS is properly configured for your domain',
    '👥 Google OAuth redirect URIs are set correctly',
    '📧 SMTP credentials use app-specific passwords',
    '🚫 No sensitive data in Git repository',
    '🔍 Environment variables validated in CI/CD',
    '📊 Error tracking configured (Sentry)',
    '⚡ Rate limiting enabled (Upstash Redis)'
  ];
  
  checks.forEach(check => {
    console.log(`  ${check}`);
  });
}

function main() {
  const command = process.argv[2];
  
  console.log(`${colors.magenta}🔐 The Corporate Blog - Secrets Manager${colors.reset}\n`);
  
  switch (command) {
    case 'generate':
      generateSecrets();
      break;
    case 'validate':
      validateEnvironment();
      break;
    case 'vercel':
      generateVercelSecrets();
      break;
    case 'cloudinary':
      generateCloudinaryPresets();
      break;
    case 'check':
      validateEnvironment();
      checkDatabaseConnection();
      break;
    case 'security':
      displaySecurityChecklist();
      break;
    default:
      console.log(`${colors.yellow}Usage:${colors.reset}`);
      console.log(`  node scripts/manage-secrets.js generate    # Generate new secrets`);
      console.log(`  node scripts/manage-secrets.js validate    # Validate .env.local`);
      console.log(`  node scripts/manage-secrets.js vercel      # Generate Vercel commands`);
      console.log(`  node scripts/manage-secrets.js cloudinary  # Cloudinary preset config`);
      console.log(`  node scripts/manage-secrets.js check       # Full environment check`);
      console.log(`  node scripts/manage-secrets.js security    # Security checklist`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateSecrets, validateEnvironment, generateVercelSecrets };