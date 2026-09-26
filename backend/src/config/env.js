'use strict';

/**
 * Central env config — fail fast at startup if a required variable is missing.
 * Import this module instead of reading process.env directly in other files.
 */

function required(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

function optional(name, fallback) {
  return process.env[name] || fallback;
}

module.exports = {
  // Server
  NODE_ENV:   optional('NODE_ENV', 'development'),
  PORT:       parseInt(optional('PORT', '5000'), 10),

  // MongoDB
  MONGODB_URI: required('MONGODB_URI'),

  // JWT
  JWT_ACCESS_SECRET:  required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_RESET_SECRET:   required('JWT_RESET_SECRET'),

  JWT_ACCESS_EXPIRES_IN:  optional('JWT_ACCESS_EXPIRES_IN',  '1h'),
  JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  JWT_RESET_EXPIRES_IN:   optional('JWT_RESET_EXPIRES_IN',   '5m'),

  // Cookie
  COOKIE_DOMAIN: optional('COOKIE_DOMAIN', 'localhost'),

  // Email (swap values when connecting a real provider)
  EMAIL_FROM:    optional('EMAIL_FROM', 'noreply@stocksense.local'),
  SMTP_HOST:     optional('SMTP_HOST', ''),
  SMTP_PORT:     parseInt(optional('SMTP_PORT', '587'), 10),
  SMTP_USER:     optional('SMTP_USER', ''),
  SMTP_PASS:     optional('SMTP_PASS', ''),
};
