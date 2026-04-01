import dotenv from 'dotenv';
import App from './app';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { connectDB } from '@/config/database';
import uptimeMonitor from '@/services/uptimeMonitor';
import logRetention from '@/services/logRetention';
import { flushSentry } from '@/config/sentry';

// Load environment variables
dotenv.config();

async function startServer(): Promise<void> {
  try {
    // Initialize database connection
    await connectDB();
    logger.info('Database connected successfully');

    // Initialize monitoring and logging services
    uptimeMonitor.start();
    logRetention.startCleanup();
    logger.info('✅ Monitoring services initialized');

    // Create Express app
    const app = new App();

    // Start server
    const server = app.app.listen(config.port, config.host, () => {
      logger.info(`🚀 Server running on ${config.host}:${config.port}`);
      logger.info(`📚 Environment: ${config.nodeEnv}`);
      logger.info(`📊 Process ID: ${process.pid}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      
      // Stop monitoring services
      uptimeMonitor.stop();
      logRetention.stopCleanup();
      
      // Flush Sentry
      await flushSentry();
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force close server after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    // Handle process signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err: Error) => {
      logger.error('Unhandled Promise Rejection:', err);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err: Error) => {
      logger.error('Uncaught Exception:', err);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();