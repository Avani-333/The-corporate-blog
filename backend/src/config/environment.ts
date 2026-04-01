import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  HOST: z.string().default('localhost'),
  
  // Database
  DATABASE_URL: z.string(),
  DIRECT_URL: z.string().optional(),
  
  // JWT
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_EXPIRE_TIME: z.string().default('15m'),
  JWT_REFRESH_EXPIRE_TIME: z.string().default('7d'),
  
  // CORS
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  
  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  
  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  FROM_EMAIL: z.string().optional(),
  FROM_NAME: z.string().optional(),
  
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  // Security
  BCRYPT_ROUNDS: z.string().transform(Number).default('12'),
  SESSION_SECRET: z.string().optional(),
  
  // Monitoring
  LOG_LEVEL: z.string().default('info'),
  SENTRY_DSN: z.string().optional(),
  
  // File Upload
  MAX_FILE_SIZE: z.string().transform(Number).default('5242880'),
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/webp,image/gif'),
});

const envVars = envSchema.parse(process.env);

export const config = {
  nodeEnv: envVars.NODE_ENV,
  port: envVars.PORT,
  host: envVars.HOST,
  
  // Database
  databaseUrl: envVars.DATABASE_URL,
  directUrl: envVars.DIRECT_URL,
  
  // JWT
  jwtSecret: envVars.JWT_SECRET,
  jwtRefreshSecret: envVars.JWT_REFRESH_SECRET,
  jwtExpireTime: envVars.JWT_EXPIRE_TIME,
  jwtRefreshExpireTime: envVars.JWT_REFRESH_EXPIRE_TIME,
  
  // CORS
  frontendUrl: envVars.FRONTEND_URL,
  allowedOrigins: envVars.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()),
  
  // Rate Limiting
  rateLimitWindow: envVars.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: envVars.RATE_LIMIT_MAX_REQUESTS,
  
  // Cloudinary
  cloudinary: {
    cloudName: envVars.CLOUDINARY_CLOUD_NAME,
    apiKey: envVars.CLOUDINARY_API_KEY,
    apiSecret: envVars.CLOUDINARY_API_SECRET,
  },
  
  // Redis
  redis: {
    url: envVars.REDIS_URL,
    password: envVars.REDIS_PASSWORD,
  },
  
  // Email
  email: {
    host: envVars.SMTP_HOST,
    port: envVars.SMTP_PORT,
    user: envVars.SMTP_USER,
    pass: envVars.SMTP_PASS,
    from: envVars.FROM_EMAIL,
    fromName: envVars.FROM_NAME,
  },
  
  // Google OAuth
  google: {
    clientId: envVars.GOOGLE_CLIENT_ID,
    clientSecret: envVars.GOOGLE_CLIENT_SECRET,
  },
  
  // Security
  bcryptRounds: envVars.BCRYPT_ROUNDS,
  sessionSecret: envVars.SESSION_SECRET,
  
  // Monitoring
  logLevel: envVars.LOG_LEVEL,
  sentryDsn: envVars.SENTRY_DSN,
  
  // File Upload
  upload: {
    maxFileSize: envVars.MAX_FILE_SIZE,
    allowedTypes: envVars.ALLOWED_FILE_TYPES.split(',').map(type => type.trim()),
  },
} as const;