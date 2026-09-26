'use strict';

const env = require('../config/env');

/**
 * Global Express error handler.
 *
 * Must be registered LAST — after all routes and other middleware.
 * Catches anything passed to next(err) or thrown inside async handlers
 * that have been wrapped with an async error boundary.
 *
 * Response shape matches the rest of the API:
 *   { success: false, error: { message, code, ...(stack in dev) } }
 */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(422).json({
      success: false,
      error: { message: messages, code: 'VALIDATION_ERROR' },
    });
  }

  // Mongoose duplicate-key error (e.g. unique index violation)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: { message: `Duplicate value for ${field}`, code: 'DUPLICATE_KEY' },
    });
  }

  // Mongoose CastError (invalid ObjectId in URL param)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: { message: `Invalid value for field: ${err.path}`, code: 'INVALID_ID' },
    });
  }

  // JWT errors that slipped through verifyToken (should not happen, but belt+braces)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token', code: 'TOKEN_INVALID' },
    });
  }

  // Generic fallback
  const statusCode = err.status || err.statusCode || 500;
  const response = {
    success: false,
    error: {
      message: statusCode === 500 ? 'Internal server error' : err.message,
      code:    err.code || 'SERVER_ERROR',
    },
  };

  // Only expose stack trace in development
  if (env.NODE_ENV === 'development' && statusCode === 500) {
    response.error.stack = err.stack;
    console.error(err);
  }

  return res.status(statusCode).json(response);
}

module.exports = { errorMiddleware };
