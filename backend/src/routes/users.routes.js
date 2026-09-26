'use strict';

const express = require('express');
const Joi = require('joi');

const profileService = require('../services/userProfile.service');
const { verifyToken } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { sendSuccess } = require('../utils/apiResponse');

const router = express.Router();

// All /api/users routes require authentication
router.use(verifyToken);

// ─── Validation schemas (inline — mirrors userProfile.service rules) ─────────

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  phone: Joi.string().trim().max(30).allow(null, ''),
  profileImageUrl: Joi.string().trim().max(2048).allow(null, ''),
}).min(1);

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).pattern(/[A-Za-z]/).pattern(/[0-9]/).required()
    .messages({ 'string.pattern.base': 'newPassword must contain at least 1 letter and 1 digit' }),
});

const changeEmailSchema = Joi.object({
  newEmail: Joi.string().email().required(),
  currentPassword: Joi.string().required(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/users/me — own profile
router.get('/me', async (req, res, next) => {
  try {
    const profile = await profileService.getProfile(req.user.userId);
    return sendSuccess(res, 200, 'Profile retrieved successfully', { user: profile });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/users/me — update name/phone/profileImageUrl
router.patch('/me', validate(updateProfileSchema), async (req, res, next) => {
  try {
    const profile = await profileService.updateProfile(req.user.userId, req.body);
    return sendSuccess(res, 200, 'Profile updated successfully', { user: profile });
  } catch (err) {
    return next(err);
  }
});

// POST /api/users/me/change-password
router.post('/me/change-password', validate(changePasswordSchema), async (req, res, next) => {
  try {
    await profileService.changePassword(req.user.userId, req.body);
    return sendSuccess(res, 200, 'Password changed successfully');
  } catch (err) {
    return next(err);
  }
});

// POST /api/users/me/change-email
router.post('/me/change-email', validate(changeEmailSchema), async (req, res, next) => {
  try {
    const profile = await profileService.changeEmail(req.user.userId, req.body);
    return sendSuccess(res, 200, 'Email changed successfully', { user: profile });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/users/me/profile-image — clear avatar
router.delete('/me/profile-image', async (req, res, next) => {
  try {
    const profile = await profileService.clearProfileImage(req.user.userId);
    return sendSuccess(res, 200, 'Profile image cleared successfully', { user: profile });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
