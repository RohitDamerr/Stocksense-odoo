'use strict';

const User               = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateOtp, hashOtp, compareOtp, otpExpiresAt, MAX_ATTEMPTS } = require('../utils/otp');
const { signAccessToken, signRefreshToken, signResetToken, verifyResetToken } = require('../utils/jwt');
const { sendPasswordResetOtp } = require('./email.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the public-facing user profile (never includes passwordHash / otpHash).
 */
function toPublicProfile(user) {
  return {
    _id:            user._id,
    name:           user.name,
    email:          user.email,
    role:           user.role,
    phone:          user.phone,
    profileImageUrl: user.profileImageUrl,
    isActive:       user.isActive,
    createdAt:      user.createdAt,
    updatedAt:      user.updatedAt,
  };
}

// ─── Signup ───────────────────────────────────────────────────────────────────

/**
 * Register a new user.
 * Throws a structured error object on failure so the controller can map it.
 *
 * @param {{ name, email, password, role, phone }} dto
 * @returns {{ user: object, accessToken: string, refreshToken: string }}
 */
async function signup({ name, email, password, role, phone }) {
  // Duplicate email check
  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error('An account with this email already exists');
    err.code   = 'EMAIL_EXISTS';
    err.status = 409;
    throw err;
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    name,
    email,
    passwordHash,
    role,
    phone: phone || null,
    isActive: true,
  });

  const accessToken  = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken(user._id);

  return { user: toPublicProfile(user), accessToken, refreshToken };
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Authenticate a user by email + password.
 *
 * @param {{ email, password }} dto
 * @returns {{ user: object, accessToken: string, refreshToken: string }}
 */
async function login({ email, password }) {
  // Always fetch passwordHash (select:false field)
  const user = await User.findOne({ email }).select('+passwordHash');

  // Generic message prevents user enumeration
  const invalidErr = new Error('Invalid email or password');
  invalidErr.code   = 'INVALID_CREDENTIALS';
  invalidErr.status = 401;

  if (!user) throw invalidErr;

  const passwordMatch = await comparePassword(password, user.passwordHash);
  if (!passwordMatch) throw invalidErr;

  if (!user.isActive) {
    const err = new Error('This account has been deactivated');
    err.code   = 'ACCOUNT_INACTIVE';
    err.status = 403;
    throw err;
  }

  const accessToken  = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken(user._id);

  return { user: toPublicProfile(user), accessToken, refreshToken };
}

// ─── Forgot password ──────────────────────────────────────────────────────────

/**
 * Generate an OTP and email it.  Always resolves (no user-enumeration leak).
 *
 * @param {{ email: string }} dto
 */
async function forgotPassword({ email }) {
  const user = await User.findOne({ email });

  // If no user: silently return — the controller always sends the same response
  if (!user) return;

  const otp     = generateOtp();
  const otpHash = await hashOtp(otp);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordReset: {
          otpHash,
          expiresAt: otpExpiresAt(),
          attempts:  0,
        },
      },
    }
  );

  // Fire-and-forget in dev; real transports await properly
  await sendPasswordResetOtp({ to: user.email, name: user.name, otp });
}

// ─── Verify OTP ───────────────────────────────────────────────────────────────

/**
 * Verify the OTP and issue a single-use reset token.
 *
 * @param {{ email: string, otp: string }} dto
 * @returns {{ resetToken: string }}
 */
async function verifyOtp({ email, otp }) {
  const user = await User.findOne({ email });

  const badOtpErr = new Error('Invalid or expired OTP');
  badOtpErr.code   = 'OTP_INVALID';
  badOtpErr.status = 400;

  // User not found or no pending reset
  if (!user || !user.passwordReset) throw badOtpErr;

  const { otpHash, expiresAt, attempts } = user.passwordReset;

  // Locked out after too many wrong guesses
  if (attempts >= MAX_ATTEMPTS) {
    const err = new Error('Too many failed attempts. Request a new OTP.');
    err.code   = 'OTP_LOCKED';
    err.status = 429;
    throw err;
  }

  // Expired
  if (new Date() > expiresAt) throw badOtpErr;

  const match = await compareOtp(otp, otpHash);

  if (!match) {
    // Increment attempt counter — do NOT clear the OTP so they can retry
    await User.updateOne(
      { _id: user._id },
      { $inc: { 'passwordReset.attempts': 1 } }
    );
    throw badOtpErr;
  }

  // OTP is valid — issue a short-lived reset token.
  // The passwordReset sub-doc is cleared only on successful password change,
  // NOT here, because the token itself is the proof of identity.
  const resetToken = signResetToken(user._id);
  return { resetToken };
}

// ─── Reset password ───────────────────────────────────────────────────────────

/**
 * Consume a reset token and set a new password.
 *
 * @param {{ resetToken: string, newPassword: string }} dto
 */
async function resetPassword({ resetToken, newPassword }) {
  let payload;
  try {
    payload = verifyResetToken(resetToken);
  } catch {
    const err = new Error('Reset token is invalid or has expired');
    err.code   = 'RESET_TOKEN_INVALID';
    err.status = 400;
    throw err;
  }

  const user = await User.findById(payload.userId);
  if (!user) {
    const err = new Error('User not found');
    err.code   = 'USER_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Verify a passwordReset is still pending (prevents replay after another reset)
  if (!user.passwordReset) {
    const err = new Error('No pending password reset for this account');
    err.code   = 'RESET_ALREADY_USED';
    err.status = 400;
    throw err;
  }

  const newHash = await hashPassword(newPassword);

  await User.updateOne(
    { _id: user._id },
    {
      $set:   { passwordHash: newHash },
      // Clearing passwordReset removes the OTP and invalidates any in-flight
      // reset tokens by ensuring the field no longer exists on the doc.
      // Refresh-token invalidation: bump updatedAt so existing refresh tokens
      // (which can be compared against updatedAt) are treated as stale.
      $unset: { passwordReset: '' },
    }
  );
}

module.exports = { signup, login, forgotPassword, verifyOtp, resetPassword };
