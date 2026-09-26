'use strict';

const mongoose = require('mongoose');
const ROLES = require('../constants/roles');

const passwordResetSchema = new mongoose.Schema(
  {
    otpHash: { type: String, required: true },   // bcrypt hash of the OTP, never store raw
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // never returned in queries by default
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: [true, 'Role is required'],
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    profileImageUrl: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Only present while a password-reset is pending; cleared after use or expiry
    passwordReset: {
      type: passwordResetSchema,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt + updatedAt
    versionKey: false,
  }
);

// Compound index for quick role-filtered lookups (e.g. "all active managers")
userSchema.index({ role: 1, isActive: 1 });

module.exports = mongoose.model('User', userSchema);
