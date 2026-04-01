#!/usr/bin/env node

/**
 * Infrastructure Setup Script for The Corporate Blog
 * Run with: node scripts/setup-infrastructure.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg) => console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.magenta}${colors.bright}=== ${msg} ===${colors.reset}`)
};

function checkRequirements() {
  log.step('Checking requirements...');
  
  const requirements = [
    { cmd: 'node --version', name: 'Node.js' },
    { cmd: 'npm --version', name: 'npm' },
    { cmd: 'git --version', name: 'Git' }
  ];
  
  for (const req of requirements) {
    try {
      const version = execSync(req.cmd, { encoding: 'utf8' }).trim();
      log.success(`${req.name}: ${version}`);
    } catch (error) {
      log.error(`${req.name} is not installed or not in PATH`);
      process.exit(1);
    }
  }
}

function installDependencies() {
  log.step('Installing dependencies...');
  
  try {
    execSync('npm ci', { stdio: 'inherit' });
    log.success('Dependencies installed successfully');
  } catch (error) {
    log.error('Failed to install dependencies');
    process.exit(1);
  }
}

function setupEnvironment() {
  log.step('Setting up environment variables...');
  
  const envExamplePath = path.join(process.cwd(), '.env.example');
  const envLocalPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envLocalPath)) {
    try {
      fs.copyFileSync(envExamplePath, envLocalPath);
      log.success('Created .env.local from .env.example');
      log.warning('Please edit .env.local with your actual values');
    } catch (error) {
      log.error('Failed to create .env.local');
    }
  } else {
    log.info('.env.local already exists');
  }
}

function generateSecrets() {
  log.step('Generating security secrets...');
  
  const crypto = await import('crypto');
  
  const secrets = {
    NEXTAUTH_SECRET: crypto.randomBytes(32).toString('base64'),
    JWT_SECRET: crypto.randomBytes(32).toString('base64'),
    CSP_NONCE_SECRET: crypto.randomBytes(24).toString('base64')
  };
  
  console.log('\n' + colors.yellow + 'Generated secrets (add these to your .env.local):' + colors.reset);
  for (const [key, value] of Object.entries(secrets)) {
    console.log(`${colors.green}${key}${colors.reset}="${value}"`);
  }
  console.log();
}

function setupPrisma() {
  log.step('Setting up Prisma...');
  
  try {
    log.info('Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    log.success('Prisma client generated');
    
    log.warning('Remember to run "npx prisma db push" after setting up your database');
  } catch (error) {
    log.error('Failed to generate Prisma client');
  }
}

function setupVercel() {
  log.step('Vercel setup instructions...');
  
  log.info('To deploy to Vercel:');
  console.log('1. Install Vercel CLI: npm i -g vercel');
  console.log('2. Login to Vercel: vercel login');
  console.log('3. Deploy: vercel --prod');
  console.log('4. Set environment variables in Vercel dashboard');
  
  log.info('Required environment variables for Vercel:');
  const requiredVars = [
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL_NON_POOLING', 
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'JWT_SECRET',
    'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];
  
  requiredVars.forEach(varName => {
    console.log(`  - ${colors.cyan}${varName}${colors.reset}`);
  });
}

function displayInfrastructureUrls() {
  log.header('Infrastructure Setup URLs');
  
  const services = [
    {
      name: 'Neon PostgreSQL',
      url: 'https://console.neon.tech',
      description: 'Create database and get connection strings'
    },
    {
      name: 'Vercel Dashboard', 
      url: 'https://vercel.com/dashboard',
      description: 'Deploy frontend and configure domains'
    },
    {
      name: 'Cloudinary Console',
      url: 'https://cloudinary.com/console',
      description: 'Set up media storage and upload presets'
    },
    {
      name: 'Cloudflare Dashboard',
      url: 'https://dash.cloudflare.com',
      description: 'Configure DNS and CDN settings'
    },
    {
      name: 'Google Cloud Console',
      url: 'https://console.developers.google.com',
      description: 'Set up OAuth for authentication'
    }
  ];
  
  services.forEach(service => {
    console.log(`\n${colors.bright}${service.name}${colors.reset}`);
    console.log(`${colors.blue}${service.url}${colors.reset}`);
    console.log(`${colors.yellow}→ ${service.description}${colors.reset}`);
  });
}

function displayNextSteps() {
  log.header('Next Steps');
  
  const steps = [
    '1. Set up Neon PostgreSQL database',
    '2. Configure Cloudinary for media storage', 
    '3. Set up Google OAuth credentials',
    '4. Update .env.local with real values',
    '5. Test locally: npm run dev',
    '6. Deploy to Vercel: vercel --prod',
    '7. Configure custom domain in Vercel',
    '8. Set up Cloudflare DNS',
    '9. Run database migrations: npx prisma db push',
    '10. Test production deployment'
  ];
  
  steps.forEach(step => {
    console.log(`${colors.green}${step}${colors.reset}`);
  });
  
  console.log(`\n${colors.yellow}📚 See DEPLOYMENT.md for detailed instructions${colors.reset}`);
}

async function main() {
  console.log(`${colors.magenta}${colors.bright}`);
  console.log('╔═══════════════════════════════════════╗');
  console.log('║        The Corporate Blog             ║'); 
  console.log('║     Infrastructure Setup Script      ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(colors.reset);
  
  checkRequirements();
  installDependencies();
  setupEnvironment();
  await generateSecrets();
  setupPrisma();
  setupVercel();
  displayInfrastructureUrls();
  displayNextSteps();
  
  log.success('\nSetup script completed! Check the instructions above.');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log.error(`Setup failed: ${error.message}`);
    process.exit(1);
  });
}

export default main;