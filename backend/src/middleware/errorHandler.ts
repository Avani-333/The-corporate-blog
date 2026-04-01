import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '@/utils/logger';
import { ApiError } from '@/utils/ApiError';
import { getRequestContext } from '@/utils/requestContext';

type HttpClass = '4xx' | '5xx';
type ErrorClass = 'validation_error' | 'auth_error' | 'client_error' | 'server_error';

interface ClassifiedError {
  httpClass: HttpClass;
  errorClass: ErrorClass;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  classification?: ErrorClass;
  httpClass?: HttpClass;
  stack?: string;
  validationErrors?: Array<{
    field: string;
    message: string;
  }>;
}

const classifyError = (err: Error, statusCode: number): ClassifiedError => {
  const isAuthError =
    statusCode === 401 ||
    statusCode === 403 ||
    err.name === 'JsonWebTokenError' ||
    err.name === 'TokenExpiredError';

  const isValidationError =
    err instanceof ZodError ||
    (err as { validationErrors?: unknown }).validationErrors !== undefined;

  if (isValidationError) {
    return { httpClass: '4xx', errorClass: 'validation_error' };
  }

  if (isAuthError) {
    return { httpClass: '4xx', errorClass: 'auth_error' };
  }

  if (statusCode >= 500) {
    return { httpClass: '5xx', errorClass: 'server_error' };
  }

  return { httpClass: '4xx', errorClass: 'client_error' };
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response<ErrorResponse>,
  next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;
  let validationErrors: Array<{ field: string; message: string }> | undefined;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new ApiError(message, 404);
  }

  // Zod validation error
  if (err instanceof ZodError) {
    validationErrors = err.errors.map(zodError => ({
      field: zodError.path.join('.'),
      message: zodError.message,
    }));

    const validationApiError = new ApiError('Invalid input data', 400);
    (validationApiError as { validationErrors?: Array<{ field: string; message: string }> }).validationErrors = validationErrors;
    error = validationApiError;
  }

  // Prisma known request errors
  if ((err as { name?: string }).name === 'PrismaClientKnownRequestError') {
    const prismaCode = (err as { code?: string }).code;

    switch (prismaCode) {
      case 'P2002':
        error = new ApiError('Resource already exists', 409);
        break;
      case 'P2025':
        error = new ApiError('Resource not found', 404);
        break;
      case 'P2003':
        error = new ApiError('Foreign key constraint failed', 400);
        break;
      default:
        error = new ApiError('Database error', 500);
    }
  }

  // Prisma validation error
  if ((err as { name?: string }).name === 'PrismaClientValidationError') {
    error = new ApiError('Invalid data provided', 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError('Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new ApiError('Token expired', 401);
  }

  // Multer errors
  if (err.name === 'MulterError') {
    const multerCode = (err as { code?: string }).code;

    if (multerCode === 'LIMIT_FILE_SIZE') {
      error = new ApiError('File size too large', 400);
    } else if (multerCode === 'LIMIT_FILE_COUNT') {
      error = new ApiError('Too many files uploaded', 400);
    } else if (multerCode === 'LIMIT_UNEXPECTED_FILE') {
      error = new ApiError('Unexpected file field', 400);
    } else {
      error = new ApiError('File upload error', 400);
    }
  }

  // Default to 500 server error
  if (!(error instanceof ApiError)) {
    error = new ApiError('Internal server error', 500);
  }

  const statusCode = (error as ApiError).statusCode || 500;
  const { httpClass, errorClass } = classifyError(err, statusCode);
  const requestContext = getRequestContext();
  const responseTimeMs = requestContext
    ? Number((Date.now() - requestContext.startedAt).toFixed(2))
    : undefined;

  logger.error('request.error', {
    requestId: req.requestId ?? requestContext?.requestId,
    method: req.method,
    route: req.originalUrl,
    userRole: req.user?.role || req.header('x-user-role') || 'anonymous',
    statusCode,
    httpClass,
    errorClass,
    responseTimeMs,
    dbQueryTimeMs: req.dbQueryTimeMs ?? requestContext?.dbQueryTimeMs,
    dbQueryCount: req.dbQueryCount ?? requestContext?.dbQueryCount,
    message: error.message,
    stack: err.stack,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  const response: ErrorResponse = {
    success: false,
    error: (error as ApiError).name || 'Error',
    message: error.message,
    statusCode,
    classification: errorClass,
    httpClass,
    validationErrors,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};