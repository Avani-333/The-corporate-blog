import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiError } from '@/utils/ApiError';

type ValidationSource = 'body' | 'query' | 'params';

interface ValidationSchemas {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}

export const validate = (schemas: ValidationSchemas) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validationPromises: Array<Promise<void>> = [];

      // Validate body
      if (schemas.body) {
        validationPromises.push(
          new Promise<void>((resolve, reject) => {
            try {
              req.body = schemas.body!.parse(req.body);
              resolve();
            } catch (error) {
              reject(error);
            }
          })
        );
      }

      // Validate query
      if (schemas.query) {
        validationPromises.push(
          new Promise<void>((resolve, reject) => {
            try {
              req.query = schemas.query!.parse(req.query);
              resolve();
            } catch (error) {
              reject(error);
            }
          })
        );
      }

      // Validate params
      if (schemas.params) {
        validationPromises.push(
          new Promise<void>((resolve, reject) => {
            try {
              req.params = schemas.params!.parse(req.params);
              resolve();
            } catch (error) {
              reject(error);
            }
          })
        );
      }

      await Promise.all(validationPromises);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        const apiError = new ApiError('Validation failed', 400);
        (apiError as any).validationErrors = validationErrors;
        next(apiError);
      } else {
        next(new ApiError('Validation error', 400));
      }
    }
  };
};

export const validateBody = (schema: z.ZodSchema) => validate({ body: schema });
export const validateQuery = (schema: z.ZodSchema) => validate({ query: schema });
export const validateParams = (schema: z.ZodSchema) => validate({ params: schema });

// Common validation schemas
export const commonSchemas = {
  id: z.object({
    id: z.string().cuid('Invalid ID format'),
  }),
  
  slug: z.object({
    slug: z.string().min(1, 'Slug is required'),
  }),
  
  pagination: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('10'),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
  
  search: z.object({
    q: z.string().min(1, 'Search query is required'),
    category: z.string().optional(),
    author: z.string().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']).optional(),
    page: z.string().transform(Number).optional(),
    limit: z.string().transform(Number).optional(),
  }),
};