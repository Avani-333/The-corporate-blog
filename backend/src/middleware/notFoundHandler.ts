import { NextFunction, Request, Response } from 'express';
import { ApiError } from '@/utils/ApiError';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  next(ApiError.notFound(`Route ${req.originalUrl} not found`));
};