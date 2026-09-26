'use strict';

const mongoose             = require('mongoose');
const User                 = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/password');

// ─── Error factories ──────────────────────────────────────────────────────────

const mkErr      = (msg, code, status) => Object.assign(new Error(msg), { code, status });
const notFound   = (msg)               => mkErr(msg, 'NOT_FOUND',    404);
const badRequest = (msg, code)         => mkErr(msg, code || 'BAD_REQUEST', 400);
const conflict   = (msg, code)         => mkErr(msg, code || 'CONFLICT',    409);
const unauthorized = (msg, code)       => mkErr(msg, code || 'UNAUTHORIZED', 401);

// ─── Safe profile projection (never includes passwordHash / passwordReset) ────

function toProfile(user) {
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

// ─── 1. Get own profile ───────────────────────────────────────────────────────

async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  return toProfile(user);
}

// ─── 2. Update own profile ────────────────────────────────────────────────────

/**
 * Only name, phone, profileImageUrl are updatable here.
 * Caller must have already stripped forbidden fields (email, password, role, isActive)
 * before calling this — the service double-checks as a safety net.
 */
async function updateProfile(userId, updates) {
  const FORBIDDEN = ['email', 'password', 'passwordHash', 'role', 'isActive'];
  for (const field of FORBIDDEN) {
    if (field in updates) {
      throw badRequest(
        `Field "${field}" cannot be changed through this endpoint`,
        'INVALID_FIELD'
      );
    }
  }

  const allowed = {};
  if (updates.name            !== undefined) allowed.name            = updates.name;
  if (updates.phone           !== undefined) allowed.phone           = updates.phone;
  if (updates.profileImageUrl !== undefined) allowed.profileImageUrl = updates.profileImageUrl;

  if (!Object.keys(allowed).length) {
    throw badRequest('Provide at least one updatable field (name, phone, profileImageUrl)', 'NO_CHANGES');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: allowed },
    { new: true, runValidators: true }
  );
  if (!user) throw notFound('User not found');
  return toProfile(user);
}

// ─── 3. Change password ───────────────────────────────────────────────────────

async function changePassword(userId, { currentPassword, newPassword }) {
  // Must select passwordHash since it has select:false on the schema
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw notFound('User not found');

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw unauthorized('Current password is incorrect', 'INVALID_CREDENTIALS');

  const newHash = await hashPassword(newPassword);

  // Update password and bump updatedAt — bumped updatedAt invalidates refresh tokens
  // that compare against this field (same pattern as reset-password flow)
  await User.updateOne(
    { _id: userId },
    {
      $set:   { passwordHash: newHash },
      $unset: { passwordReset: '' },  // clear any pending reset
    }
  );
}

// ─── 4. Change email ──────────────────────────────────────────────────────────

async function changeEmail(userId, { newEmail, currentPassword }) {
  const normalised = newEmail.toLowerCase().trim();

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw notFound('User not found');

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw unauthorized('Current password is incorrect', 'INVALID_CREDENTIALS');

  // Check no other account already uses this email
  const taken = await User.findOne({ email: normalised, _id: { $ne: userId } });
  if (taken) throw conflict('This email address is already in use', 'EMAIL_EXISTS');

  await User.updateOne({ _id: userId }, { $set: { email: normalised } });

  // Return refreshed profile
  const updated = await User.findById(userId);
  return toProfile(updated);
}

// ─── 5. Clear profile image ───────────────────────────────────────────────────

async function clearProfileImage(userId) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { profileImageUrl: null } },
    { new: true }
  );
  if (!user) throw notFound('User not found');
  return toProfile(user);
}

module.exports = { getProfile, updateProfile, changePassword, changeEmail, clearProfileImage };
