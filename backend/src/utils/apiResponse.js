'use strict';

/**
 * Uniform JSON envelope for every API response.
 *
 * Success:  { success: true,  data,    message }
 * Error:    { success: false, error:   { message, code?, details? } }
 */

/**
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {*} [data]
 */
function sendSuccess(res, statusCode, message, data = null) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {string|null} [code]   - machine-readable error code, e.g. "EMAIL_EXISTS"
 * @param {*} [details]          - extra debug info (never include secrets)
 */
function sendError(res, statusCode, message, code = null, details = null) {
  const error = { message };
  if (code)    error.code    = code;
  if (details) error.details = details;

  return res.status(statusCode).json({
    success: false,
    error,
  });
}

module.exports = { sendSuccess, sendError };
