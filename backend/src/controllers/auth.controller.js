'use strict';

const authService        = require('../services/auth.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const env                = require('../config/env');

// ─── Cookie helpers ───────────────────────────────────────────────────────────

const REFRESH_COOKIE = 'refreshToken';

/**
 * ms equivalent of the refresh token expiry string (e.g. "7d" → 7 * 86400000).
 * Kept simple — only handles "Nd" and "Nh" formats used in env.js defaults.
 */
function refreshCookieMaxAge() {
  const str = env.JWT_REFRESH_EXPIRES_IN; // e.g. "7d"
  const num  = parseInt(str, 10);
  if (str.endsWith('d')) return num * 24 * 60 * 60 * 1000;
  if (str.endsWith('h')) return num * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000; // fallback: 7 days
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure:   env.NODE_ENV === 'production', // HTTPS-only in prod
    sameSite: 'strict',
    maxAge:   refreshCookieMaxAge(),
    domain:   env.NODE_ENV === 'production' ? env.COOKIE_DOMAIN : undefined,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: 'strict' });
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/signup
 */
async function signup(req, res) {
  try {
    const { user, accessToken, refreshToken } = await authService.signup(req.body);
    setRefreshCookie(res, refreshToken);
    return sendSuccess(res, 201, 'Account created successfully', { user, accessToken });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SIGNUP_ERROR');
  }
}

/**
 * POST /api/auth/login
 * On success the frontend should redirect to /dashboard.
 */
async function login(req, res) {
  try {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    setRefreshCookie(res, refreshToken);
    return sendSuccess(res, 200, 'Login successful', {
      user,
      accessToken,
      redirectTo: '/dashboard',
    });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'LOGIN_ERROR');
  }
}

/**
 * POST /api/auth/logout
 * Clears the refresh-token cookie; access token expiry is handled client-side.
 */
async function logout(req, res) {
  clearRefreshCookie(res);
  return sendSuccess(res, 200, 'Logged out successfully');
}

/**
 * POST /api/auth/forgot-password
 * Always returns 200 regardless of whether the email exists (anti-enumeration).
 */
async function forgotPassword(req, res) {
  try {
    await authService.forgotPassword(req.body);
  } catch {
    // Swallow errors — still return generic message
  }
  return sendSuccess(
    res,
    200,
    'If an account with that email exists, a reset code has been sent.'
  );
}

/**
 * POST /api/auth/verify-otp
 */
async function verifyOtp(req, res) {
  try {
    const { resetToken } = await authService.verifyOtp(req.body);
    return sendSuccess(res, 200, 'OTP verified. Use the reset token to set a new password.', {
      resetToken,
    });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'OTP_ERROR');
  }
}

/**
 * POST /api/auth/reset-password
 */
async function resetPassword(req, res) {
  try {
    await authService.resetPassword(req.body);
    return sendSuccess(res, 200, 'Password reset successfully. Please log in with your new password.');
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'RESET_ERROR');
  }
}

module.exports = { signup, login, logout, forgotPassword, verifyOtp, resetPassword };
