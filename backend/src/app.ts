import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import 'express-async-errors';

import { config } from '@/config/environment';
import { initializeSentry, sentryRequestHandler, sentryErrorHandler } from '@/config/sentry';
import { errorHandler } from '@/middleware/errorHandler';
import { notFoundHandler } from '@/middleware/notFoundHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { requestTracing } from '@/middleware/requestTracing';
import { metricsCollector } from '@/middleware/metricsCollector';

// Routes
import authRoutes from '@/routes/auth';
import postRoutes from '@/routes/posts';
import categoryRoutes from '@/routes/categories';
import userRoutes from '@/routes/users';
import uploadRoutes from '@/routes/upload';
import searchRoutes from '@/routes/search';
import analyticsRoutes from '@/routes/analytics';
import metricsRoutes from '@/routes/metrics';
import healthRoutes from '@/routes/health';
import dashboardRoutes from '@/routes/dashboard';
import exportRoutes from '@/routes/export';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Initialize Sentry for error tracking
    initializeSentry();

    // Trust first proxy hop so req.ip is derived by Express from trusted proxy metadata.
    this.app.set('trust proxy', 1);

    // Sentry request handler
    this.app.use(sentryRequestHandler());

    // Correlate each request and propagate x-request-id.
    this.app.use(requestTracing);

    // Security middlewares
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.allowedOrigins,
      credentials: true,
      optionsSuccessStatus: 200,
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimitWindow,
      max: config.rateLimitMax,
      message: {
        error: 'Too many requests from this IP, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.app.use('/api', limiter);

    // Slow down repeated requests
    const speedLimiter = slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 100, // allow 100 requests per 15 minutes at full speed
      delayMs: 500, // slow down subsequent requests by 500ms per request
    });

    this.app.use('/api', speedLimiter);

    // Body parsing middleware with size limits
    // - API routes: 1MB default (prevents large payloads)
    // - Upload routes: 50MB (for file uploads)
    this.app.use((req, res, next) => {
      const limit = req.path.startsWith('/api/upload') ? '50mb' : '1mb';
      return express.json({ limit })(req, res, next);
    });

    this.app.use((req, res, next) => {
      const limit = req.path.startsWith('/api/upload') ? '50mb' : '1mb';
      return express.urlencoded({ extended: true, limit })(req, res, next);
    });
    this.app.use(cookieParser());

    // Compression
    this.app.use(compression());

    this.app.use(requestLogger);
    this.app.use(metricsCollector);
  }

  private initializeRoutes(): void {
    // Health check routes (before other routes)
    this.app.use('/health', healthRoutes);

    // Database health dashboard
    this.app.use('/api/dashboard', dashboardRoutes);

    // Internal operational metrics endpoint.
    this.app.use('/metrics', metricsRoutes);

    // Admin export routes
    this.app.use('/api/admin', exportRoutes);

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/posts', postRoutes);
    this.app.use('/api/categories', categoryRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/upload', uploadRoutes);
    this.app.use('/api/search', searchRoutes);
    this.app.use('/api/analytics', analyticsRoutes);

    // API base route
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        message: 'The Corporate Blog API',
        version: '1.0.0',
        documentation: '/api/docs',
      });
    });
  }

  private initializeErrorHandling(): void {
    // Sentry error handler (must come before other error handlers)
    this.app.use(sentryErrorHandler());

    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }
}

export default App;