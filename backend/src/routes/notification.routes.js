const express = require('express');
const router = express.Router();
const notificationService = require('../services/notification.service');
const { verifyToken } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { getNotificationsSchema, markAsReadSchema } = require('../validators/notification.validator');
const { successResponse } = require('../utils/apiResponse');

// All routes require authentication
router.use(verifyToken);

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get('/', validate(getNotificationsSchema, 'query'), async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { read, limit, skip } = req.query;

    const options = {
      limit: limit ? parseInt(limit) : 50,
      skip: skip ? parseInt(skip) : 0
    };

    if (read !== undefined) {
      options.read = read === 'true';
    }

    const result = await notificationService.getNotifications(userId, options);
    res.json(successResponse(result, 'Notifications retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch('/:id/read', validate(markAsReadSchema, 'params'), async (req, res, next) => {
  try {
    const userId = req.user._id;
    const notificationId = req.params.id;

    const notification = await notificationService.markAsRead(notificationId, userId);
    res.json(successResponse(notification, 'Notification marked as read'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/read-all', async (req, res, next) => {
  try {
    const userId = req.user._id;

    const count = await notificationService.markAllAsRead(userId);
    res.json(successResponse({ count }, `${count} notification(s) marked as read`));
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:id', validate(markAsReadSchema, 'params'), async (req, res, next) => {
  try {
    const userId = req.user._id;
    const notificationId = req.params.id;

    await notificationService.deleteNotification(notificationId, userId);
    res.json(successResponse(null, 'Notification deleted successfully'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
