/**
 * Error handling middleware
 */

// Custom error class
export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async error handler wrapper
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

/**
 * Global error handler
 */
export const globalErrorHandler = (error, req, res, next) => {
  let err = { ...error };
  err.message = error.message;

  // Log error for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('Error Stack:', error.stack);
  }

  // Mongoose bad ObjectId
  if (error.name === 'CastError') {
    const message = 'Invalid resource ID';
    err = new AppError(message, 400);
  }

  // Mongoose duplicate key
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const message = `${field} already exists`;
    err = new AppError(message, 400);
  }

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors)
      .map(val => val.message)
      .join(', ');
    err = new AppError(message, 400);
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    err = new AppError(message, 401);
  }

  if (error.name === 'TokenExpiredError') {
    const message = 'Token expired';
    err = new AppError(message, 401);
  }

  // File upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    const message = 'File size too large';
    err = new AppError(message, 400);
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    err = new AppError(message, 400);
  }

  // Send error response
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      error: err,
      stack: error.stack
    })
  });
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejections = () => {
  process.on('unhandledRejection', (err, promise) => {
    console.log('Unhandled Promise Rejection:', err.message);
    console.log('Shutting down server...');
    process.exit(1);
  });
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtExceptions = () => {
  process.on('uncaughtException', (err) => {
    console.log('Uncaught Exception:', err.message);
    console.log('Shutting down server...');
    process.exit(1);
  });
};

export default {
  AppError,
  asyncHandler,
  notFoundHandler,
  globalErrorHandler,
  handleUnhandledRejections,
  handleUncaughtExceptions
};