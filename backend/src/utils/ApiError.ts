export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string = 'Bad Request'): ApiError {
    return new ApiError(message, 400);
  }

  static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(message, 401);
  }

  static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(message, 403);
  }

  static notFound(message: string = 'Resource not found'): ApiError {
    return new ApiError(message, 404);
  }

  static conflict(message: string = 'Resource already exists'): ApiError {
    return new ApiError(message, 409);
  }

  static internal(message: string = 'Internal server error'): ApiError {
    return new ApiError(message, 500);
  }
}