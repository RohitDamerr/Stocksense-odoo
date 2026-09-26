'use strict';

const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');

const OTP_LENGTH   = 6;
const OTP_SALT_ROUNDS = 10; // slightly lighter than password hashing — OTPs are short-lived
const OTP_TTL_MS   = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

/**
 * Generate a cryptographically random 6-digit numeric OTP string.
 * Uses crypto.randomInt to avoid modulo bias.
 * @returns {string}  e.g. "048271"
 */
function generateOtp() {
  // randomInt(min, max) — max is exclusive, so 10^6 gives 000000–999999
  const raw = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return String(raw).padStart(OTP_LENGTH, '0');
}

/**
 * Hash a plain OTP for safe storage.
 * @param {string} otp
 * @returns {Promise<string>} bcrypt hash
 */
async function hashOtp(otp) {
  return bcrypt.hash(otp, OTP_SALT_ROUNDS);
}

/**
 * Compare a plain OTP against a stored bcrypt hash.
 * @param {string} otp
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function compareOtp(otp, hash) {
  return bcrypt.compare(otp, hash);
}

/**
 * Return the Date at which a freshly generated OTP expires.
 * @returns {Date}
 */
function otpExpiresAt() {
  return new Date(Date.now() + OTP_TTL_MS);
}

module.exports = {
  generateOtp,
  hashOtp,
  compareOtp,
  otpExpiresAt,
  MAX_ATTEMPTS,
};
