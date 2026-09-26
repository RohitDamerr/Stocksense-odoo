'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

// ─── Access token ────────────────────────────────────────────────────────────

/**
 * Issue a short-lived access token.
 * Payload: { userId, role }
 */
function signAccessToken(userId, role) {
  return jwt.sign(
    { userId: userId.toString(), role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );
}

/**
 * @param {string} token
 * @returns {{ userId: string, role: string, iat: number, exp: number }}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

// ─── Refresh token ───────────────────────────────────────────────────────────

/**
 * Issue a long-lived refresh token.
 * Payload: { userId }  (role intentionally omitted — re-fetched on refresh)
 */
function signRefreshToken(userId) {
  return jwt.sign(
    { userId: userId.toString() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
}

/**
 * @param {string} token
 * @returns {{ userId: string, iat: number, exp: number }}
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

// ─── Password-reset token ────────────────────────────────────────────────────

/**
 * Issue a single-purpose, very short-lived reset token.
 * Payload: { userId, purpose: "password_reset" }
 */
function signResetToken(userId) {
  return jwt.sign(
    { userId: userId.toString(), purpose: 'password_reset' },
    env.JWT_RESET_SECRET,
    { expiresIn: env.JWT_RESET_EXPIRES_IN }
  );
}

/**
 * Verify and assert the purpose claim.
 * @param {string} token
 * @returns {{ userId: string, purpose: string, iat: number, exp: number }}
 * @throws {Error} if token is invalid, expired, or purpose is wrong
 */
function verifyResetToken(token) {
  const payload = jwt.verify(token, env.JWT_RESET_SECRET);
  if (payload.purpose !== 'password_reset') {
    throw new Error('Invalid token purpose');
  }
  return payload;
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signResetToken,
  verifyResetToken,
};
