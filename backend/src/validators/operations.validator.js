'use strict';

const Joi = require('joi');

const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .message('Must be a valid ObjectId');

/** GET /api/operations — query params */
const listOperationsSchema = Joi.object({
  documentType: Joi.array().items(
    Joi.string().valid('receipt', 'delivery', 'transfer', 'adjustment')
  ).optional(),
  status:       Joi.string().valid('draft', 'waiting', 'ready', 'done', 'canceled').optional(),
  warehouse:    objectId.optional(),
  category:     objectId.optional(),   // filter: any line's product belongs to this category (+ descendants)
  locationId:   objectId.optional(),   // filter: operations involving this location
  dateFrom:     Joi.date().iso().optional(),
  dateTo:       Joi.date().iso().min(Joi.ref('dateFrom')).optional()
    .messages({ 'date.min': 'dateTo must be on or after dateFrom' }),
  sortBy:       Joi.string().valid('createdAt', 'updatedAt').default('updatedAt'),
  sortOrder:    Joi.string().valid('asc', 'desc').default('desc'),
  page:         Joi.number().integer().min(1).default(1),
  limit:        Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  listOperationsSchema
};