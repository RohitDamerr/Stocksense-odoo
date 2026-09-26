'use strict';

const Joi = require('joi');

const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .message('Must be a valid ObjectId');

// ─── Per-line schema ──────────────────────────────────────────────────────────

const lineSchema = Joi.object({
  product:              objectId.required(),
  quantity:             Joi.number().min(1).required(),
  sourceWarehouse:      objectId.required(),
  sourceLocation:       objectId.required(),
  destinationWarehouse: objectId.required(),
  destinationLocation:  objectId.required(),
});

// ─── Request body schemas ─────────────────────────────────────────────────────

/** POST /api/internal-transfers */
const createTransferSchema = Joi.object({
  scheduledDate: Joi.date().iso().optional().allow(null),
  lines:         Joi.array().items(lineSchema).min(0).default([]),
});

/** PATCH /api/internal-transfers/:id */
const updateTransferSchema = Joi.object({
  scheduledDate: Joi.date().iso().optional().allow(null),
  lines:         Joi.array().items(lineSchema).optional(),
}).min(1).messages({ 'object.min': 'Provide at least one field to update' });

/** POST /api/internal-transfers/:id/lines */
const addLineSchema = lineSchema;

/** GET /api/internal-transfers — query params */
const listTransfersSchema = Joi.object({
  status:    Joi.string().valid('draft', 'waiting', 'ready', 'done', 'canceled').optional(),
  warehouse: objectId.optional(),   // matches source OR destination on any line
  category:  objectId.optional(),   // filter: any line's product belongs to this category (+ descendants)
  dateFrom:  Joi.date().iso().optional(),
  dateTo:    Joi.date().iso().min(Joi.ref('dateFrom')).optional()
    .messages({ 'date.min': 'dateTo must be on or after dateFrom' }),
  page:      Joi.number().integer().min(1).default(1),
  limit:     Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createTransferSchema,
  updateTransferSchema,
  addLineSchema,
  listTransfersSchema,
};
