'use strict';

const express    = require('express');
const rateLimit  = require('express-rate-limit');

const authController = require('../controllers/auth.controller');
const { validate }   = require('../middleware/validate.middleware');
const { verifyToken } = require('../middleware/auth.middleware');
const {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
} = require('../validators/auth.validator');

const router = express.Router();

// ─── Rate limiters ────────────────────────────────────────────────────────────

/**
 * Login limiter: 5 attempts per 15 minutes per IP.
 * Keyed by IP; extend to key by email by replacing `keyGenerator` if desired.
 */
const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              5,
  standardHeaders:  true,  // Return rate-limit info in `RateLimit-*` headers
  legacyHeaders:    false,
  message: {
    success: false,
    error: {
      message: 'Too many login attempts. Please try again in 15 minutes.',
      code:    'RATE_LIMITED',
    },
  },
});

/**
 * OTP request limiter: 3 OTP requests per 15 minutes per IP.
 * Throttles spam without fully blocking legitimate users who mistype email.
 */
const otpRequestLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              3,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success: false,
    error: {
      message: 'Too many reset requests. Please try again in 15 minutes.',
      code:    'RATE_LIMITED',
    },
  },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/auth/signup
router.post('/signup',
  validate(signupSchema),
  authController.signup
);

// POST /api/auth/login
router.post('/login',
  loginLimiter,
  validate(loginSchema),
  authController.login
);

// POST /api/auth/logout  (protected — must be logged in to log out)
router.post('/logout',
  verifyToken,
  authController.logout
);

// POST /api/auth/forgot-password
router.post('/forgot-password',
  otpRequestLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

// POST /api/auth/verify-otp
router.post('/verify-otp',
  validate(verifyOtpSchema),
  authController.verifyOtp
);

// POST /api/auth/reset-password
router.post('/reset-password',
  validate(resetPasswordSchema),
  authController.resetPassword
);

module.exports = router;
