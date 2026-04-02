import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const router = Router();

// Middleware to verify API key for admin operations
const verifyExportKey = (req: Request, res: Response, next: Function) => {
  const apiKey = req.headers['x-export-key'] || req.query.key;
  const validKey = process.env.EXPORT_API_KEY;

  if (!validKey) {
    return res.status(500).json({ error: 'Export API key not configured' });
  }

  if (apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

/**
 * POST /api/admin/export
 * Trigger database export
 */
router.post('/api/admin/export', verifyExportKey, async (req: Request, res: Response) => {
  try {
    const { formats = 'sql,csv', dryRun = false, includeCleanup = true } = req.body;
    
    // Build command
    let command = 'node scripts/weekly-export.js';
    
    if (dryRun) {
      command += ' --dry-run';
    }
    
    if (formats) {
      command += ` --formats ${formats}`;
    }
    
    if (!includeCleanup) {
      command += ' --no-cleanup';
    }

    // Return immediately with job ID, run in background
    const jobId = `export-${Date.now()}`;
    
    // Execute export in background
    executeExportAsync(command, jobId, res);

  } catch (error) {
    console.error('Export route error:', error);
    res.status(500).json({ error: 'Failed to start export' });
  }
});

/**
 * GET /api/admin/export/status/:jobId
 * Check export status
 */
router.get('/api/admin/export/status/:jobId', verifyExportKey, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const statusFile = path.join(process.cwd(), '.export-status', `${jobId}.json`);

    if (!fs.existsSync(statusFile)) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const status = JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
    res.json(status);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

/**
 * GET /api/admin/export/list
 * List recent exports
 */
router.get('/api/admin/export/list', verifyExportKey, async (req: Request, res: Response) => {
  try {
    const exportDir = process.env.EXPORT_DIR || './exports';
    
    if (!fs.existsSync(exportDir)) {
      return res.json({ exports: [], total: '0MB' });
    }

    const files = fs.readdirSync(exportDir);
    const exports = files.map(file => {
      const filePath = path.join(exportDir, file);
      const stats = fs.statSync(filePath);
      return {
        filename: file,
        size: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString()
      };
    });

    const total = (exports.reduce((sum, e) => sum + parseFloat(e.size), 0)).toFixed(2);

    res.json({
      exports: exports.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()),
      total: `${total}MB`,
      count: exports.length
    });
  } catch (error) {
    console.error('List exports error:', error);
    res.status(500).json({ error: 'Failed to list exports' });
  }
});

/**
 * DELETE /api/admin/export/:filename
 * Delete specific export
 */
router.delete('/api/admin/export/:filename', verifyExportKey, async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const exportDir = process.env.EXPORT_DIR || './exports';
    const filePath = path.join(exportDir, filename);

    // Security: prevent directory traversal
    if (!path.resolve(filePath).startsWith(path.resolve(exportDir))) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: `Deleted ${filename}` });
  } catch (error) {
    console.error('Delete export error:', error);
    res.status(500).json({ error: 'Failed to delete export' });
  }
});

/**
 * Execute export in background
 */
function executeExportAsync(command: string, jobId: string, res: Response) {
  const statusDir = path.join(process.cwd(), '.export-status');
  
  if (!fs.existsSync(statusDir)) {
    fs.mkdirSync(statusDir, { recursive: true });
  }

  const statusFile = path.join(statusDir, `${jobId}.json`);
  const startTime = Date.now();

  // Save initial status
  fs.writeFileSync(statusFile, JSON.stringify({
    jobId,
    status: 'running',
    started: new Date().toISOString(),
    command
  }));

  // Return job ID to client
  res.json({
    jobId,
    message: 'Export started',
    statusUrl: `/api/admin/export/status/${jobId}`
  });

  // Run export in background
  const child = spawn('bash', ['-c', command], {
    cwd: process.cwd(),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  let errorOutput = '';

  child.stdout?.on('data', (data) => {
    output += data.toString();
  });

  child.stderr?.on('data', (data) => {
    errorOutput += data.toString();
  });

  child.on('close', (code) => {
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    
    const finalStatus = {
      jobId,
      status: code === 0 ? 'completed' : 'failed',
      started: new Date(startTime).toISOString(),
      completed: new Date().toISOString(),
      duration: `${duration} minutes`,
      exitCode: code,
      output: output.substring(output.length - 1000), // Last 1000 chars
      error: errorOutput.substring(errorOutput.length - 1000)
    };

    fs.writeFileSync(statusFile, JSON.stringify(finalStatus, null, 2));
  });

  // Detach process
  child.unref();
}

export default router;
