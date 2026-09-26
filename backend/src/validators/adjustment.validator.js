'use strict';

const Joi = require('joi');

// Import the enum directly from the model so it stays in sync
const { VALID_REASONS } = require('../models/StockAdjustment');

const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .message('Must be a valid ObjectId');

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

// Line supplied at creation time — countedQty is optional here
const createLineSchema = Joi.object({
  product:    objectId.required(),
  location:   objectId.required(),
  countedQty: Joi.number().min(0).optional().allow(null),
  reason:     Joi.string().valid(...VALID_REASONS).optional().allow(null, ''),
});

// Line added via POST /:id/lines — same shape
const addLineSchema = createLineSchema;

// ─── Request body schemas ─────────────────────────────────────────────────────

/** POST /api/stock-adjustments */
const createAdjustmentSchema = Joi.object({
  warehouse: objectId.required(),
  lines:     Joi.array().items(createLineSchema).min(0).default([]),
});

/** PATCH /api/stock-adjustments/:id/lines/:lineId/count */
const countLineSchema = Joi.object({
  countedQty: Joi.number().min(0).required()
    .messages({ 'number.min': 'countedQty cannot be negative (0 is valid — use 0 for empty shelf)' }),
  reason: Joi.string().valid(...VALID_REASONS).optional().allow(null, ''),
});

/** GET /api/stock-adjustments — query params */
const listAdjustmentsSchema = Joi.object({
  status:     Joi.string().valid('draft', 'done', 'canceled').optional(),
  warehouse:  objectId.optional(),
  category:   objectId.optional(),   // filter: any line's product belongs to this category (+ descendants)
  reason:     Joi.string().valid(...VALID_REASONS).optional(),
  locationId: objectId.optional(),   // filter: adjustments at this location
  dateFrom:   Joi.date().iso().optional(),
  dateTo:     Joi.date().iso().min(Joi.ref('dateFrom')).optional()
    .messages({ 'date.min': 'dateTo must be on or after dateFrom' }),
  page:       Joi.number().integer().min(1).default(1),
  limit:      Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createAdjustmentSchema,
  addLineSchema,
  countLineSchema,
  listAdjustmentsSchema,
};
