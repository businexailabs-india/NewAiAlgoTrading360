import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Custom error class
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  reason?: string;
  correctiveAction?: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    meta?: { reason?: string; correctiveAction?: string; details?: Record<string, unknown> }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.reason = meta?.reason;
    this.correctiveAction = meta?.correctiveAction;
    this.details = meta?.details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handler middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });

  // Default error values
  let statusCode = 500;
  let message = 'Internal server error';
  let isOperational = false;

  // Check if it's our custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
  }

  if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Database error';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message: message,
    ...(err instanceof AppError && err.reason ? { reason: err.reason } : {}),
    ...(err instanceof AppError && err.correctiveAction
      ? { correctiveAction: err.correctiveAction }
      : {}),
    ...(err instanceof AppError && err.details ? { details: err.details } : {}),
    ...(process.env.NODE_ENV === 'development' && {
      error: err.message,
      stack: err.stack
    })
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not found handler
export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(`Route not found: ${req.originalUrl}`, 404);
  next(error);
};

// Validation error handler
export const validationError = (errors: any[]): AppError => {
  const message = errors.map(err => err.message).join(', ');
  return new AppError(message, 400);
};
