const Joi = require('joi');

const getNotificationsSchema = Joi.object({
  read: Joi.string().valid('true', 'false').optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  skip: Joi.number().integer().min(0).optional()
});

const markAsReadSchema = Joi.object({
  id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
});

module.exports = {
  getNotificationsSchema,
  markAsReadSchema
};
