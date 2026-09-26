'use strict';

const Joi = require('joi');

const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .message('Must be a valid ObjectId');

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

const lineSchema = Joi.object({
  product:             objectId.required(),
  expectedQty:         Joi.number().min(1).required(),
  destinationLocation: objectId.required(),
});

// ─── Request body schemas ─────────────────────────────────────────────────────

/**
 * POST /api/receipts
 */
const createReceiptSchema = Joi.object({
  supplier:             objectId.required(),
  destinationWarehouse: objectId.required(),
  scheduledDate:        Joi.date().iso().optional().allow(null),
  lines:                Joi.array().items(lineSchema).min(0).default([]),
});

/**
 * PATCH /api/receipts/:id
 * Every field is optional — send only what changed.
 */
const updateReceiptSchema = Joi.object({
  supplier:             objectId.optional(),
  destinationWarehouse: objectId.optional(),
  scheduledDate:        Joi.date().iso().optional().allow(null),
  lines:                Joi.array().items(lineSchema).optional(),
}).min(1).messages({ 'object.min': 'Provide at least one field to update' });

/**
 * POST /api/receipts/:id/lines
 */
const addLineSchema = lineSchema;

/**
 * PATCH /api/receipts/:id/lines/:lineId/receive
 */
const receiveQtySchema = Joi.object({
  receivedQty: Joi.number().min(0).required(),
});

/**
 * GET /api/receipts  — query params
 */
const listReceiptsSchema = Joi.object({
  status:               Joi.string().valid('draft', 'waiting', 'ready', 'done', 'canceled').optional(),
  destinationWarehouse: objectId.optional(),
  supplier:             objectId.optional(),
  category:             objectId.optional(),   // filter: any line's product belongs to this category (+ descendants)
  dateFrom:             Joi.date().iso().optional(),
  dateTo:               Joi.date().iso().min(Joi.ref('dateFrom')).optional()
    .messages({ 'date.min': 'dateTo must be on or after dateFrom' }),
  page:                 Joi.number().integer().min(1).default(1),
  limit:                Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createReceiptSchema,
  updateReceiptSchema,
  addLineSchema,
  receiveQtySchema,
  listReceiptsSchema,
};
