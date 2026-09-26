'use strict';

const Joi = require('joi');

const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .message('Must be a valid ObjectId');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const customerSchema = Joi.object({
  name:    Joi.string().trim().min(1).max(200).required(),
  address: Joi.string().trim().max(500).optional().allow('', null),
  contact: Joi.string().trim().max(200).optional().allow('', null),
});

const lineSchema = Joi.object({
  product:        objectId.required(),
  orderedQty:     Joi.number().min(1).required(),
  sourceLocation: objectId.required(),
});

// ─── Request body schemas ─────────────────────────────────────────────────────

/** POST /api/delivery-orders */
const createDeliveryOrderSchema = Joi.object({
  customer:        customerSchema.required(),
  sourceWarehouse: objectId.required(),
  scheduledDate:   Joi.date().iso().optional().allow(null),
  lines:           Joi.array().items(lineSchema).min(0).default([]),
});

/** PATCH /api/delivery-orders/:id */
const updateDeliveryOrderSchema = Joi.object({
  customer:        customerSchema.optional(),
  sourceWarehouse: objectId.optional(),
  scheduledDate:   Joi.date().iso().optional().allow(null),
  lines:           Joi.array().items(lineSchema).optional(),
}).min(1).messages({ 'object.min': 'Provide at least one field to update' });

/** POST /api/delivery-orders/:id/lines */
const addLineSchema = lineSchema;

/** PATCH /api/delivery-orders/:id/lines/:lineId/pick */
const pickQtySchema = Joi.object({
  pickedQty: Joi.number().min(0).required(),
});

/** PATCH /api/delivery-orders/:id/lines/:lineId/pack */
const packQtySchema = Joi.object({
  packedQty: Joi.number().min(0).required(),
});

/** GET /api/delivery-orders — query params */
const listDeliveryOrdersSchema = Joi.object({
  status:          Joi.string().valid('draft', 'waiting', 'ready', 'done', 'canceled').optional(),
  sourceWarehouse: objectId.optional(),
  category:        objectId.optional(),   // filter: any line's product belongs to this category (+ descendants)
  dateFrom:        Joi.date().iso().optional(),
  dateTo:          Joi.date().iso().min(Joi.ref('dateFrom')).optional()
    .messages({ 'date.min': 'dateTo must be on or after dateFrom' }),
  page:            Joi.number().integer().min(1).default(1),
  limit:           Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createDeliveryOrderSchema,
  updateDeliveryOrderSchema,
  addLineSchema,
  pickQtySchema,
  packQtySchema,
  listDeliveryOrdersSchema,
};
