#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { runQuickAudit, runLighthouseAudit, LighthouseBenchmark, PERFORMANCE_THRESHOLDS } from '../lib/lighthouse.js';
import { validatePageSEO, runSEOAudit, generateSEOReport } from '../lib/seo-validation.js';
import { generatePostSEO, DEFAULT_SEO_CONFIG } from '../lib/seo.js';
import fs from 'fs/promises';
import path from 'path';

const program = new Command();

program
  .name('tcb-benchmark')
  .description('The Corporate Blog - Lighthouse & SEO Benchmarking Tool')
  .version('1.0.0');

// ============================================================================
// LIGHTHOUSE COMMANDS
// ============================================================================

program
  .command('audit')
  .description('Run a single Lighthouse audit')
  .argument('<url>', 'URL to audit')
  .option('-o, --output <path>', 'Output directory for reports')
  .option('--json', 'Output results as JSON')
  .option('--html', 'Generate HTML report')
  .action(async (url, options) => {
    const spinner = ora('Running Lighthouse audit...').start();
    
    try {
      if (options.json || options.html) {
        const result = await runLighthouseAudit({
          url,
          options: {
            output: options.json ? 'json' : 'html',
            chromeFlags: ['--headless', '--no-sandbox']
          }
        });
        
        const outputDir = options.output || './lighthouse-reports';
        await fs.mkdir(outputDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const hostname = new URL(url).hostname.replace(/\./g, '_');
        const ext = options.json ? 'json' : 'html';
        const filename = `lighthouse-${hostname}-${timestamp}.${ext}`;
        const filepath = path.join(outputDir, filename);
        
        await fs.writeFile(filepath, JSON.stringify(result, null, 2));
        
        spinner.succeed(`Report saved to: ${filepath}`);
      } else {
        spinner.stop();
        await runQuickAudit(url);
      }
    } catch (error) {
      spinner.fail('Audit failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('benchmark')
  .description('Run continuous benchmarking')
  .argument('<urls...>', 'URLs to benchmark')
  .option('-c, --config <path>', 'Benchmark configuration file')
  .option('-f, --frequency <freq>', 'Benchmark frequency (daily|weekly|monthly)', 'daily')
  .option('--report', 'Generate report after benchmark')
  .action(async (urls, options) => {
    const spinner = ora('Running benchmark suite...').start();
    
    try {
      let config;
      
      if (options.config) {
        const configFile = await fs.readFile(options.config, 'utf-8');
        config = JSON.parse(configFile);
      } else {
        config = {
          urls,
          frequency: options.frequency,
          thresholds: PERFORMANCE_THRESHOLDS,
          notifications: {}
        };
      }
      
      const benchmark = new LighthouseBenchmark(config);
      const results = await benchmark.runBenchmark();
      
      spinner.succeed(`Benchmark completed for ${results.length} URLs`);
      
      if (options.report) {
        console.log('\n' + chalk.blue('📊 Generating benchmark report...'));
        const report = await benchmark.generateReport();
        console.log(report);
      }
      
      // Display summary
      results.forEach(result => {
        const avgScore = Math.round(
          (result.scores.performance + result.scores.accessibility + 
           result.scores.bestPractices + result.scores.seo) / 4
        );
        
        console.log(chalk.cyan(`\n${result.url}`));
        console.log(`Score: ${avgScore}/100 ${avgScore >= 90 ? '✅' : avgScore >= 70 ? '⚠️' : '❌'}`);
        console.log(`Performance: ${result.scores.performance} | SEO: ${result.scores.seo}`);
      });
      
    } catch (error) {
      spinner.fail('Benchmark failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// ============================================================================
// SEO COMMANDS
// ============================================================================

program
  .command('seo-audit')
  .description('Run SEO audit for a URL')
  .argument('<url>', 'URL to audit for SEO')
  .option('-m, --metadata <path>', 'SEO metadata JSON file')
  .option('--fetch-html', 'Fetch and analyze HTML content')
  .action(async (url, options) => {
    const spinner = ora('Running SEO audit...').start();
    
    try {
      let metadata;
      
      if (options.metadata) {
        const metadataFile = await fs.readFile(options.metadata, 'utf-8');
        metadata = JSON.parse(metadataFile);
      } else {
        // Generate default metadata
        metadata = {
          title: DEFAULT_SEO_CONFIG.title,
          description: DEFAULT_SEO_CONFIG.description,
          canonical: url,
          openGraph: {
            title: DEFAULT_SEO_CONFIG.title,
            description: DEFAULT_SEO_CONFIG.description,
            type: 'website',
            url: url,
            siteName: DEFAULT_SEO_CONFIG.siteName,
            images: [{
              url: `${DEFAULT_SEO_CONFIG.canonical}${DEFAULT_SEO_CONFIG.defaultImage}`,
              width: 1200,
              height: 630,
              alt: DEFAULT_SEO_CONFIG.title
            }]
          },
          twitter: {
            card: 'summary_large_image',
            site: DEFAULT_SEO_CONFIG.twitterHandle
          }
        };
      }
      
      const fetchHTML = options.fetchHtml ? async () => {
        const response = await fetch(url);
        return response.text();
      } : undefined;
      
      const result = await runSEOAudit(url, metadata, fetchHTML);
      const report = generateSEOReport(result);
      
      spinner.succeed('SEO audit completed');
      
      console.log('\n' + chalk.blue('📋 SEO Audit Report'));
      console.log('='.repeat(50));
      console.log(report);
      
      // Save report
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const hostname = new URL(url).hostname.replace(/\./g, '_');
      const filename = `seo-audit-${hostname}-${timestamp}.md`;
      const outputDir = './seo-reports';
      
      await fs.mkdir(outputDir, { recursive: true });
      const filepath = path.join(outputDir, filename);
      await fs.writeFile(filepath, report);
      
      console.log(chalk.green(`\n💾 Report saved to: ${filepath}`));
      
    } catch (error) {
      spinner.fail('SEO audit failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('validate-seo')
  .description('Validate SEO metadata structure')
  .argument '<metadata>', 'Path to SEO metadata JSON file'
  .action(async (metadataPath) => {
    try {
      const metadataFile = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataFile);
      
      const result = validatePageSEO(metadata);
      
      console.log(chalk.blue(`\n📊 SEO Validation Results`));
      console.log(`Score: ${result.score}/100 (${result.passed}/${result.total} checks passed)`);
      
      if (result.errors.length > 0) {
        console.log(chalk.red('\n🚨 Critical Issues:'));
        result.errors.forEach(error => console.log(chalk.red(`  - ${error}`)));
      }
      
      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️ Warnings:'));
        result.warnings.forEach(warning => console.log(chalk.yellow(`  - ${warning}`)));
      }
      
      if (result.recommendations.length > 0) {
        console.log(chalk.cyan('\n💡 Recommendations:'));
        result.recommendations.forEach(rec => console.log(chalk.cyan(`  - ${rec}`)));
      }
      
      if (result.score >= 90) {
        console.log(chalk.green('\n✅ Excellent SEO optimization!'));
      } else if (result.score >= 70) {
        console.log(chalk.yellow('\n⚠️ Good SEO with room for improvement'));
      } else {
        console.log(chalk.red('\n❌ Poor SEO - requires immediate attention'));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(chalk.red('Error validating SEO metadata:'), error.message);
      process.exit(1);
    }
  });

// ============================================================================
// CONFIGURATION COMMANDS
// ============================================================================

program
  .command('init')
  .description('Initialize benchmark configuration')
  .option('-o, --output <path>', 'Output path for config file', 'benchmark.config.json')
  .action(async (options) => {
    const config = {
      urls: [
        'https://localhost:3000',
        'https://localhost:3000/blog',
        'https://localhost:3000/blog/sample-post'
      ],
      frequency: 'daily',
      thresholds: PERFORMANCE_THRESHOLDS,
      notifications: {
        email: [],
        webhook: '',
        slack: ''
      }
    };
    
    await fs.writeFile(options.output, JSON.stringify(config, null, 2));
    console.log(chalk.green(`✅ Configuration created: ${options.output}`));
    console.log(chalk.cyan('Edit the file to customize URLs, thresholds, and notifications'));
  });

program
  .command('generate-metadata')
  .description('Generate SEO metadata template')
  .argument('<type>', 'Metadata type (homepage|post|category|author)')
  .option('-o, --output <path>', 'Output path for metadata file')
  .action(async (type, options) => {
    let metadata;
    
    switch (type) {
      case 'homepage':
        const { generateHomepageSEO } = await import('../lib/seo.js');
        metadata = generateHomepageSEO();
        break;
        
      case 'post':
        metadata = {
          title: 'Sample Blog Post Title',
          description: 'This is a sample blog post description that should be compelling and under 160 characters.',
          keywords: ['blog', 'sample', 'post'],
          canonical: 'https://example.com/blog/sample-post',
          openGraph: {
            title: 'Sample Blog Post Title',
            description: 'This is a sample blog post description for social sharing.',
            type: 'article',
            url: 'https://example.com/blog/sample-post',
            siteName: 'The Corporate Blog',
            images: [{
              url: 'https://example.com/og-image.jpg',
              width: 1200,
              height: 630,
              alt: 'Sample Blog Post'
            }]
          },
          twitter: {
            card: 'summary_large_image',
            site: '@thecorporateblog',
            creator: '@author'
          },
          article: {
            publishedTime: '2024-01-01T00:00:00Z',
            modifiedTime: '2024-01-01T00:00:00Z',
            authors: ['Author Name'],
            section: 'Blog',
            tags: ['tag1', 'tag2']
          }
        };
        break;
        
      default:
        console.error(chalk.red(`Unknown metadata type: ${type}`));
        console.log(chalk.cyan('Available types: homepage, post, category, author'));
        process.exit(1);
    }
    
    const outputPath = options.output || `${type}-metadata.json`;
    await fs.writeFile(outputPath, JSON.stringify(metadata, null, 2));
    
    console.log(chalk.green(`✅ SEO metadata template created: ${outputPath}`));
    console.log(chalk.cyan('Edit the file to customize for your content'));
  });

// ============================================================================
// MONITORING COMMANDS
// ============================================================================

program
  .command('monitor')
  .description('Start continuous monitoring')
  .option('-c, --config <path>', 'Configuration file path', 'benchmark.config.json')
  .option('-i, --interval <minutes>', 'Check interval in minutes', '60')
  .action(async (options) => {
    console.log(chalk.blue('🔍 Starting continuous monitoring...'));
    
    try {
      const configFile = await fs.readFile(options.config, 'utf-8');
      const config = JSON.parse(configFile);
      const benchmark = new LighthouseBenchmark(config);
      
      const interval = parseInt(options.interval) * 60 * 1000; // Convert to ms
      
      const runMonitoring = async () => {
        console.log(chalk.cyan(`\n⏰ ${new Date().toISOString()} - Running scheduled audit...`));
        
        try {
          const results = await benchmark.runBenchmark();
          
          results.forEach(result => {
            const avgScore = Math.round(
              (result.scores.performance + result.scores.accessibility + 
               result.scores.bestPractices + result.scores.seo) / 4
            );
            
            console.log(`${result.url}: ${avgScore}/100 ${avgScore >= 90 ? '✅' : avgScore >= 70 ? '⚠️' : '❌'}`);
          });
          
        } catch (error) {
          console.error(chalk.red('Monitoring check failed:'), error.message);
        }
      };
      
      // Run initial audit
      await runMonitoring();
      
      // Schedule recurring audits
      setInterval(runMonitoring, interval);
      
      console.log(chalk.green(`✅ Monitoring started (checking every ${options.interval} minutes)`));
      console.log(chalk.cyan('Press Ctrl+C to stop monitoring'));
      
    } catch (error) {
      console.error(chalk.red('Failed to start monitoring:'), error.message);
      process.exit(1);
    }
  });

// ============================================================================
// REPORTING COMMANDS
// ============================================================================

program
  .command('report')
  .description('Generate performance report')
  .option('-d, --days <number>', 'Include results from last N days', '7')
  .option('-u, --url <url>', 'Generate report for specific URL')
  .option('-o, --output <path>', 'Output file path')
  .action(async (options) => {
    console.log(chalk.blue('📊 Generating performance report...'));
    
    try {
      // Load historical results from files
      const reportsDir = './lighthouse-reports';
      
      try {
        await fs.access(reportsDir);
      } catch {
        console.error(chalk.red('No benchmark reports found. Run "tcb-benchmark audit" first.'));
        process.exit(1);
      }
      
      const files = await fs.readdir(reportsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        console.error(chalk.red('No benchmark data found.'));
        process.exit(1);
      }
      
      // Load and filter results
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(options.days));
      
      const results = [];
      for (const file of jsonFiles) {
        const filepath = path.join(reportsDir, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const result = JSON.parse(content);
        
        const resultDate = new Date(result.timestamp);
        if (resultDate >= cutoffDate) {
          if (!options.url || result.url === options.url) {
            results.push(result);
          }
        }
      }
      
      if (results.length === 0) {
        console.error(chalk.red('No matching results found.'));
        process.exit(1);
      }
      
      // Group by URL
      const grouped = results.reduce((acc, result) => {
        if (!acc[result.url]) acc[result.url] = [];
        acc[result.url].push(result);
        return acc;
      }, {});
      
      let report = `# Performance Report\n\n**Generated:** ${new Date().toISOString()}\n**Period:** Last ${options.days} days\n\n`;
      
      for (const [url, urlResults] of Object.entries(grouped)) {
        const latest = urlResults[urlResults.length - 1];
        const avgScore = Math.round(
          (latest.scores.performance + latest.scores.accessibility + 
           latest.scores.bestPractices + latest.scores.seo) / 4
        );
        
        report += `## ${url}\n\n`;
        report += `**Latest Score:** ${avgScore}/100\n`;
        report += `**Results:** ${urlResults.length} audits\n\n`;
        
        report += `| Date | Performance | SEO | Accessibility | Best Practices |\n`;
        report += `|------|-------------|-----|---------------|----------------|\n`;
        
        urlResults.slice(-10).forEach(result => {
          const date = new Date(result.timestamp).toLocaleDateString();
          report += `| ${date} | ${result.scores.performance} | ${result.scores.seo} | ${result.scores.accessibility} | ${result.scores.bestPractices} |\n`;
        });
        
        report += '\n';
      }
      
      if (options.output) {
        await fs.writeFile(options.output, report);
        console.log(chalk.green(`✅ Report saved to: ${options.output}`));
      } else {
        console.log(report);
      }
      
    } catch (error) {
      console.error(chalk.red('Failed to generate report:'), error.message);
      process.exit(1);
    }
  });

// ============================================================================
// ERROR HANDLING
// ============================================================================

program.configureHelp({
  sortSubcommands: true,
});

program.on('command:*', () => {
  console.error(chalk.red(`Invalid command: ${program.args.join(' ')}`));
  console.log(chalk.cyan('See --help for a list of available commands.'));
  process.exit(1);
});

// Parse arguments
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}