'use strict';

/**
 * Stock Ledger — read-only movement history.
 * Uses the { warehouse: 1, timestamp: -1 } index added in GAP 2 for
 * warehouse-scoped queries, and { product: 1, location: 1, timestamp: -1 }
 * for product+location scoped queries.
 *
 * All endpoints are read-only — the ledger is immutable.
 */

const express  = require('express');
const mongoose = require('mongoose');
const Joi      = require('joi');
const { verifyToken }  = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const StockLedger = require('../models/StockLedger');

const router = express.Router();
router.use(verifyToken);
router.use(requireRole('inventory_manager', 'admin', 'warehouse_staff'));

// ─── Query param schema ───────────────────────────────────────────────────────

const objectId = Joi.string().pattern(/^[a-f\d]{24}$/i).message('Must be a valid ObjectId');

const listLedgerSchema = Joi.object({
  warehouse:    objectId.optional(),
  product:      objectId.optional(),
  location:     objectId.optional(),
  movementType: Joi.string()
    .valid('receipt', 'delivery', 'transfer_in', 'transfer_out', 'adjustment')
    .optional(),
  dateFrom:     Joi.date().iso().optional(),
  dateTo:       Joi.date().iso().min(Joi.ref('dateFrom')).optional()
    .messages({ 'date.min': 'dateTo must be on or after dateFrom' }),
  page:         Joi.number().integer().min(1).default(1),
  limit:        Joi.number().integer().min(1).max(200).default(50),
});

// ─── GET /api/stock-ledger ────────────────────────────────────────────────────
// Sorted by timestamp DESC — newest movements first.
// Applies warehouse index when ?warehouse= is present (GAP 2 fix).

router.get('/', async (req, res) => {
  try {
    const { error, value } = listLedgerSchema.validate(req.query, {
      abortEarly: true, stripUnknown: true, convert: true,
    });
    if (error) {
      return sendError(res, 400, error.details[0].message.replace(/['"]/g, ''), 'VALIDATION_ERROR');
    }

    const { warehouse, product, location, movementType, dateFrom, dateTo, page, limit } = value;

    const query = {};
    if (warehouse)    query.warehouse    = new mongoose.Types.ObjectId(warehouse);
    if (product)      query.product      = new mongoose.Types.ObjectId(product);
    if (location)     query.location     = new mongoose.Types.ObjectId(location);
    if (movementType) query.movementType = movementType;

    if (dateFrom || dateTo) {
      query.timestamp = {};
      if (dateFrom) query.timestamp.$gte = new Date(dateFrom);
      if (dateTo)   query.timestamp.$lte = new Date(dateTo);
    }

    const skip  = (page - 1) * limit;
    const total = await StockLedger.countDocuments(query);

    const entries = await StockLedger.find(query)
      .populate('product',     'name sku unitOfMeasure')
      .populate('warehouse',   'name code')
      .populate('location',    'name type')
      .populate('performedBy', 'name email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return sendSuccess(res, 200, 'Stock ledger entries retrieved', {
      entries, total, page, limit,
    });
  } catch (err) {
    return sendError(res, 500, err.message, 'SERVER_ERROR');
  }
});

// ─── GET /api/stock-ledger/:id ────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return sendError(res, 400, 'Invalid ledger entry id', 'INVALID_ID');
    }
    const entry = await StockLedger.findById(req.params.id)
      .populate('product',     'name sku unitOfMeasure')
      .populate('warehouse',   'name code')
      .populate('location',    'name type')
      .populate('performedBy', 'name email');

    if (!entry) return sendError(res, 404, 'Ledger entry not found', 'NOT_FOUND');
    return sendSuccess(res, 200, 'Ledger entry retrieved', { entry });
  } catch (err) {
    return sendError(res, 500, err.message, 'SERVER_ERROR');
  }
});

module.exports = router;
