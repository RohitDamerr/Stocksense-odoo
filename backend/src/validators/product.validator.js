'use strict';

const Joi = require('joi');

const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .message('Must be a valid ObjectId');

// Allowed units of measure
const UNITS_OF_MEASURE = ['pcs', 'kg', 'g', 'l', 'ml', 'box', 'carton', 'pack', 'pair', 'roll', 'm', 'cm'];

// ─── Reorder rule (shared between create + update) ────────────────────────────

const reorderRuleSchema = Joi.object({
  minQty: Joi.number().min(0).required(),
  maxQty: Joi.number()
    .min(0)
    .greater(Joi.ref('minQty'))
    .required()
    .messages({ 'number.greater': 'maxQty must be greater than minQty' }),
  reorderQty: Joi.number().min(1).required(),
  preferredSupplier: objectId.optional().allow(null),
});

// ─── Category schemas ─────────────────────────────────────────────────────────

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  parentCategory: objectId.optional().allow(null),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  parentCategory: objectId.optional().allow(null),
}).min(1).messages({ 'object.min': 'Provide at least one field to update' });

// ─── Product schemas ──────────────────────────────────────────────────────────

const initialStockSchema = Joi.object({
  warehouse: objectId.required(),
  location:  objectId.required(),
  quantity:  Joi.number().min(1).required(),
});

const createProductSchema = Joi.object({
  name:          Joi.string().trim().min(1).max(200).required(),
  sku:           Joi.string().trim().min(1).max(100).required(),
  barcode:       Joi.string().trim().max(100).optional().allow('', null),
  category:      objectId.required(),
  unitOfMeasure: Joi.string().valid(...UNITS_OF_MEASURE).required().messages({
    'any.only': `unitOfMeasure must be one of: ${UNITS_OF_MEASURE.join(', ')}`,
  }),
  description:   Joi.string().trim().max(1000).optional().allow('', null),
  reorderRule:   reorderRuleSchema.optional().allow(null),
  initialStock:  initialStockSchema.optional().allow(null),
});

const updateProductSchema = Joi.object({
  // sku is intentionally absent — immutable after creation
  name:          Joi.string().trim().min(1).max(200),
  barcode:       Joi.string().trim().max(100).optional().allow('', null),
  category:      objectId,
  unitOfMeasure: Joi.string().valid(...UNITS_OF_MEASURE).messages({
    'any.only': `unitOfMeasure must be one of: ${UNITS_OF_MEASURE.join(', ')}`,
  }),
  description:   Joi.string().trim().max(1000).optional().allow('', null),
  reorderRule:   reorderRuleSchema.optional().allow(null),
  isActive:      Joi.boolean(),
  // Explicit rejection of sku — caught before this schema runs in the controller
}).min(1).messages({ 'object.min': 'Provide at least one field to update' });

// ─── Query params schema for GET /api/products ───────────────────────────────

const listProductsSchema = Joi.object({
  search:   Joi.string().trim().max(200).optional().allow(''),
  category: objectId.optional(),
  isActive: Joi.boolean().optional(),
  page:     Joi.number().integer().min(1).default(1),
  limit:    Joi.number().integer().min(1).max(100).default(20),
  sortBy:   Joi.string().valid('name', 'sku', 'createdAt').default('createdAt'),
  sortOrder:Joi.string().valid('asc', 'desc').default('desc'),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  UNITS_OF_MEASURE,
};
