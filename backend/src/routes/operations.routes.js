'use strict';

const express = require('express');
const Joi     = require('joi');
const { verifyToken }  = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { listAllOperations } = require('../services/operations.service');

const router = express.Router();
router.use(verifyToken);
router.use(requireRole('inventory_manager', 'admin', 'warehouse_staff'));

// ─── Validation schema ────────────────────────────────────────────────────────

const objectId = Joi.string().pattern(/^[a-f\d]{24}$/i).message('Must be a valid ObjectId');

const VALID_DOC_TYPES = ['receipt', 'delivery', 'transfer', 'adjustment'];
const VALID_STATUSES  = ['draft', 'waiting', 'ready', 'done', 'canceled'];

const listOperationsSchema = Joi.object({
  // Accept a single value OR a comma-separated string (easier for query strings)
  documentType: Joi.alternatives().try(
    Joi.array().items(Joi.string().valid(...VALID_DOC_TYPES)).min(1),
    Joi.string().valid(...VALID_DOC_TYPES)
  ).optional().messages({
    'any.only': `documentType must be one or more of: ${VALID_DOC_TYPES.join(', ')}`,
  }),
  status:    Joi.string().valid(...VALID_STATUSES).optional(),
  warehouse: objectId.optional(),
  category:  objectId.optional(),
  dateFrom:  Joi.date().iso().optional(),
  dateTo:    Joi.date().iso().min(Joi.ref('dateFrom')).optional()
    .messages({ 'date.min': 'dateTo must be on or after dateFrom' }),
  sortBy:    Joi.string().valid('createdAt', 'scheduledDate').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  page:      Joi.number().integer().min(1).default(1),
  limit:     Joi.number().integer().min(1).max(100).default(20),
});

// ─── GET /api/operations ──────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { error, value } = listOperationsSchema.validate(req.query, {
      abortEarly: true,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      return sendError(res, 422, error.details[0].message.replace(/['"]/g, ''), 'VALIDATION_ERROR');
    }

    // Normalise documentType to an array (or null for "all")
    let documentType = null;
    if (value.documentType) {
      documentType = Array.isArray(value.documentType)
        ? value.documentType
        : [value.documentType];
    }

    const result = await listAllOperations({ ...value, documentType });
    return sendSuccess(res, 200, 'Operations feed retrieved', result);
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
});

module.exports = router;
