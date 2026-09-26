'use strict';

const Joi = require('joi');
const ROLES = require('../constants/roles');

// ─── Reusable field definitions ───────────────────────────────────────────────

const emailField = Joi.string().email({ tlds: { allow: false } }).lowercase().trim().required();

const passwordField = Joi
  .string()
  .min(8)
  .pattern(/[A-Za-z]/, 'at least one letter')
  .pattern(/[0-9]/,    'at least one number')
  .required()
  .messages({
    'string.min':     'Password must be at least 8 characters',
    'string.pattern.name': 'Password must contain {{#name}}',
  });

// Roles that can self-register — "admin" is never allowed here
const REGISTERABLE_ROLES = Object.values(ROLES).filter((r) => r !== ROLES.ADMIN);

// ─── Schemas ──────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/signup
 */
const signupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: emailField,
  password: passwordField,
  role: Joi.string()
    .valid(...REGISTERABLE_ROLES)
    .required()
    .messages({
      'any.only': `Role must be one of: ${REGISTERABLE_ROLES.join(', ')}`,
    }),
  phone: Joi.string().trim().max(30).optional().allow('', null),
});

/**
 * POST /api/auth/login
 */
const loginSchema = Joi.object({
  email: emailField,
  password: Joi.string().required(),
});

/**
 * POST /api/auth/forgot-password
 */
const forgotPasswordSchema = Joi.object({
  email: emailField,
});

/**
 * POST /api/auth/verify-otp
 */
const verifyOtpSchema = Joi.object({
  email: emailField,
  otp: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.length':  'OTP must be exactly 6 digits',
      'string.pattern.base': 'OTP must contain only digits',
    }),
});

/**
 * POST /api/auth/reset-password
 */
const resetPasswordSchema = Joi.object({
  resetToken: Joi.string().required(),
  newPassword: passwordField.label('New password'),
});

module.exports = {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
};
