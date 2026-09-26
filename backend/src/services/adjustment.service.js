'use strict';

const mongoose         = require('mongoose');
const StockAdjustment  = require('../models/StockAdjustment');
const Product          = require('../models/Product');
const Warehouse        = require('../models/Warehouse');
const Location         = require('../models/Location');
const StockQuantity    = require('../models/StockQuantity');
const StockLedger      = require('../models/StockLedger');
const { ADJUSTMENT_STATUS } = require('../constants/status');
const MOVEMENT_TYPES   = require('../constants/movementTypes');
const { generateDocNumber } = require('../utils/generateNumber');
const notificationService = require('./notification.service');

// ─── Error factories ──────────────────────────────────────────────────────────

const mkErr      = (msg, code, status) => Object.assign(new Error(msg), { code, status });
const notFound   = (msg)               => mkErr(msg, 'NOT_FOUND',   404);
const badRequest = (msg, code)         => mkErr(msg, code || 'BAD_REQUEST', 400);
const conflict   = (msg, code)         => mkErr(msg, code || 'CONFLICT',    409);

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function assertWarehouse(id) {
  const wh = await Warehouse.findById(id);
  if (!wh)          throw notFound('Warehouse not found');
  if (!wh.isActive) throw badRequest('Warehouse is inactive', 'WAREHOUSE_INACTIVE');
  return wh;
}

/**
 * Validate a line reference and return the snapshotted systemQty.
 * - product must exist + active
 * - location must exist + active + belong to warehouseId
 * - systemQty = current StockQuantity.quantityOnHand (0 if no row exists)
 */
async function resolveLineSnapshot(productId, locationId, warehouseId) {
  const product = await Product.findById(productId);
  if (!product)          throw notFound(`Product not found: ${productId}`);
  if (!product.isActive) throw badRequest(`Product is inactive: ${product.name}`, 'PRODUCT_INACTIVE');

  const location = await Location.findById(locationId);
  if (!location)          throw notFound(`Location not found: ${locationId}`);
  if (!location.isActive) throw badRequest(`Location is inactive: ${location.name}`, 'LOCATION_INACTIVE');
  if (location.warehouse.toString() !== warehouseId.toString()) {
    throw badRequest(
      `Location "${location.name}" does not belong to the specified warehouse`,
      'LOCATION_WAREHOUSE_MISMATCH'
    );
  }

  const sq = await StockQuantity.findOne({ product: productId, location: locationId });
  const systemQty = sq?.quantityOnHand ?? 0;

  return { product, location, systemQty, sq };
}

/** Reject edits to done/canceled adjustments */
function assertDraft(adjustment) {
  if (adjustment.status !== ADJUSTMENT_STATUS.DRAFT) {
    throw conflict(
      `Adjustment ${adjustment.adjustmentNumber} is ${adjustment.status} and cannot be modified`,
      'ADJUSTMENT_IMMUTABLE'
    );
  }
}

// ─── 1. Create ────────────────────────────────────────────────────────────────

async function createAdjustment({ warehouse, lines }, createdBy) {
  await assertWarehouse(warehouse);

  const adjustmentNumber = await generateDocNumber('ADJ');

  const formattedLines = [];
  for (const l of (lines || [])) {
    const { systemQty } = await resolveLineSnapshot(l.product, l.location, warehouse);
    const countedQty = l.countedQty ?? null;
    const difference = countedQty !== null ? countedQty - systemQty : null;
    formattedLines.push({
      product:    l.product,
      location:   l.location,
      systemQty,
      countedQty,
      difference,
      reason:     l.reason || null,
    });
  }

  const adjustment = await StockAdjustment.create({
    adjustmentNumber,
    warehouse,
    status:    ADJUSTMENT_STATUS.DRAFT,
    lines:     formattedLines,
    createdBy,
  });

  return adjustment;
}

// ─── 2a. Add a line ───────────────────────────────────────────────────────────

async function addLine(id, lineData) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid adjustment id', 'INVALID_ID');

  const adjustment = await StockAdjustment.findById(id);
  if (!adjustment) throw notFound('Adjustment not found');
  assertDraft(adjustment);

  const { systemQty } = await resolveLineSnapshot(
    lineData.product, lineData.location, adjustment.warehouse
  );

  const countedQty = lineData.countedQty ?? null;
  const difference = countedQty !== null ? countedQty - systemQty : null;

  adjustment.lines.push({
    product:    lineData.product,
    location:   lineData.location,
    systemQty,
    countedQty,
    difference,
    reason:     lineData.reason || null,
  });

  await adjustment.save();
  return adjustment;
}

// ─── 2b. Remove a line ────────────────────────────────────────────────────────

async function removeLine(id, lineId) {
  if (!mongoose.isValidObjectId(id))     throw badRequest('Invalid adjustment id', 'INVALID_ID');
  if (!mongoose.isValidObjectId(lineId)) throw badRequest('Invalid line id', 'INVALID_ID');

  const adjustment = await StockAdjustment.findById(id);
  if (!adjustment) throw notFound('Adjustment not found');
  assertDraft(adjustment);

  const idx = adjustment.lines.findIndex((l) => l._id.toString() === lineId);
  if (idx === -1) throw notFound('Line not found on this adjustment');

  adjustment.lines.splice(idx, 1);
  await adjustment.save();
  return adjustment;
}

// ─── 3. Enter counted quantity ────────────────────────────────────────────────

async function countLine(id, lineId, { countedQty, reason }) {
  if (!mongoose.isValidObjectId(id))     throw badRequest('Invalid adjustment id', 'INVALID_ID');
  if (!mongoose.isValidObjectId(lineId)) throw badRequest('Invalid line id', 'INVALID_ID');

  const adjustment = await StockAdjustment.findById(id);
  if (!adjustment) throw notFound('Adjustment not found');
  assertDraft(adjustment);

  const line = adjustment.lines.find((l) => l._id.toString() === lineId);
  if (!line) throw notFound('Line not found on this adjustment');

  // Refresh systemQty against the live StockQuantity — stock may have changed
  // since the line was first added (other receipts/deliveries may have run)
  const sq = await StockQuantity.findOne({ product: line.product, location: line.location });
  const liveSystemQty = sq?.quantityOnHand ?? 0;

  line.systemQty  = liveSystemQty;
  line.countedQty = countedQty;
  line.difference = countedQty - liveSystemQty;  // server-side, never from client
  if (reason !== undefined) line.reason = reason || null;

  await adjustment.save();
  return adjustment;
}

// ─── 4. Validate → $set stock (transactional) ─────────────────────────────────

/**
 * Core correction step. Mirrors receipt/delivery/transfer validateXxx structure.
 *
 * KEY DIFFERENCE: uses $set for quantityOnHand (absolute correction),
 * NOT $inc (relative change).
 *
 * @param {string} adjustmentId
 * @param {string} userId
 * @returns {{ adjustment, summary, warnings }}
 */
async function validateAdjustment(adjustmentId, userId) {
  if (!mongoose.isValidObjectId(adjustmentId))
    throw badRequest('Invalid adjustment id', 'INVALID_ID');

  const adjustment = await StockAdjustment.findById(adjustmentId);
  if (!adjustment) throw notFound('Adjustment not found');

  if (adjustment.status !== ADJUSTMENT_STATUS.DRAFT) {
    throw conflict(
      `Adjustment is already ${adjustment.status} and cannot be validated`,
      'ADJUSTMENT_IMMUTABLE'
    );
  }

  if (!adjustment.lines.length) {
    throw badRequest('Cannot validate an adjustment with no lines', 'NO_LINES');
  }

  // Every line must have had countedQty entered
  const uncounted = adjustment.lines.filter((l) => l.countedQty === null || l.countedQty === undefined);
  if (uncounted.length) {
    throw badRequest(
      `${uncounted.length} line(s) have no counted quantity yet. ` +
      'Use PATCH .../lines/:lineId/count on each line first.',
      'UNCOUNTED_LINES'
    );
  }

  const now      = new Date();
  const summary  = [];
  const warnings = [];

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const line of adjustment.lines) {

        // ── Final race-condition guard ────────────────────────────────────────
        // Re-read the live StockQuantity one last time inside the transaction.
        // If another operation changed stock since the count was entered,
        // recompute difference against the truly current value.
        const liveSQ = await StockQuantity.findOne(
          { product: line.product, location: line.location },
          null,
          { session }
        );

        const liveSystemQty = liveSQ?.quantityOnHand ?? 0;
        const finalDiff     = line.countedQty - liveSystemQty;

        // Persist refreshed systemQty and recomputed difference onto the line
        line.systemQty  = liveSystemQty;
        line.difference = finalDiff;

        const reserved   = liveSQ?.quantityReserved ?? 0;
        const newOnHand  = line.countedQty;
        // Never let quantityAvailable go negative — clamp to 0 and warn
        const newAvailable = Math.max(0, newOnHand - reserved);

        if (reserved > newOnHand) {
          warnings.push({
            product:  line.product,
            location: line.location,
            message:
              `quantityReserved (${reserved}) exceeds new countedQty (${newOnHand}). ` +
              `quantityAvailable clamped to 0. Review open delivery orders for this product.`,
          });
        }

        // ── $set StockQuantity (absolute correction, NOT $inc) ────────────────
        await StockQuantity.findOneAndUpdate(
          { product: line.product, location: line.location },
          {
            $set: {
              quantityOnHand:    newOnHand,
              quantityAvailable: newAvailable,
              warehouse:         adjustment.warehouse,
              lastMovementAt:    now,
            },
          },
          {
            upsert:              true,
            new:                 true,
            session,
            setDefaultsOnInsert: true,
          }
        );

        // ── Insert StockLedger entry ──────────────────────────────────────────
        // Skip lines where the final difference is 0 — stock is confirmed correct,
        // no ledger entry needed. This keeps the audit trail clean.
        if (finalDiff !== 0) {
          await StockLedger.create(
            [{
              product:        line.product,
              warehouse:      adjustment.warehouse,
              location:       line.location,
              movementType:   MOVEMENT_TYPES.ADJUSTMENT,
              quantityChange: finalDiff,       // signed: positive = found, negative = lost
              balanceAfter:   newOnHand,
              reference: {
                docType:   'StockAdjustment',
                docId:     adjustment._id,
                docNumber: adjustment.adjustmentNumber,
              },
              performedBy: userId,
              timestamp:   now,
            }],
            { session }
          );
        }

        summary.push({
          product:    line.product,
          location:   line.location,
          systemQty:  liveSystemQty,
          countedQty: line.countedQty,
          difference: finalDiff,
          reason:     line.reason,
          ledgerWritten: finalDiff !== 0,
        });
      }

      // Stamp adjustment as done (also persists refreshed systemQty/difference on lines)
      await StockAdjustment.findOneAndUpdate(
        { _id: adjustment._id },
        {
          $set: {
            status:      ADJUSTMENT_STATUS.DONE,
            validatedAt: now,
            validatedBy: userId,
            lines:       adjustment.lines,  // persist refreshed systemQty + difference
          },
        },
        { session }
      );
    });
  } finally {
    session.endSession();
  }

  // Reload fully populated for the response
  const updated = await StockAdjustment.findById(adjustmentId)
    .populate('warehouse',          'name code')
    .populate('createdBy',          'name email')
    .populate('validatedBy',        'name email')
    .populate('lines.product',      'name sku unitOfMeasure')
    .populate('lines.location',     'name type');

  // Notify operation completion
  notificationService.notifyOperationCompleted(
    'Adjustment',
    updated._id,
    updated.adjustmentNumber,
    updated.warehouse._id
  ).catch(err => console.error('Notification error:', err));

  // Check stock levels for all adjusted products
  for (const line of adjustment.lines) {
    notificationService.checkStockLevels(
      line.product,
      adjustment.warehouse
    ).catch(err => console.error('Stock check error:', err));
  }

  return { adjustment: updated, summary, warnings };
}

// ─── 5. Cancel ────────────────────────────────────────────────────────────────

async function cancelAdjustment(id) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid adjustment id', 'INVALID_ID');

  const adjustment = await StockAdjustment.findById(id);
  if (!adjustment) throw notFound('Adjustment not found');

  // Only draft can be canceled — done has already corrected stock
  if (adjustment.status === ADJUSTMENT_STATUS.DONE) {
    throw conflict(
      'A validated adjustment cannot be canceled — create a new adjustment to reverse the correction',
      'ADJUSTMENT_DONE'
    );
  }
  if (adjustment.status === ADJUSTMENT_STATUS.CANCELED) {
    throw conflict('Adjustment is already canceled', 'ALREADY_CANCELED');
  }

  adjustment.status = ADJUSTMENT_STATUS.CANCELED;
  await adjustment.save();
  return adjustment;
}

// ─── 6. List ─────────────────────────────────────────────────────────────────

async function listAdjustments({ status, warehouse, category, reason, locationId, dateFrom, dateTo, page, limit }) {
  const { buildCategoryStages } = require('../utils/categoryPipeline');

  const baseMatch = {};
  if (status)    baseMatch.status    = status;
  if (warehouse) baseMatch.warehouse = new mongoose.Types.ObjectId(warehouse);
  if (reason)    baseMatch['lines.reason'] = reason;
  if (dateFrom || dateTo) {
    baseMatch.createdAt = {};
    if (dateFrom) baseMatch.createdAt.$gte = new Date(dateFrom);
    if (dateTo)   baseMatch.createdAt.$lte = new Date(dateTo);
  }

  const categoryStages = await buildCategoryStages(category);
  if (categoryStages === null) {
    const e = new Error('Category not found'); e.code = 'NOT_FOUND'; e.status = 404; throw e;
  }

  const skip = (page - 1) * limit;

  const pipeline = [
    { $match: baseMatch },
    ...categoryStages,
    
    // Apply location filter if specified (adjustments at this location)
    ...(locationId ? [
      { $match: { 'lines.location': new mongoose.Types.ObjectId(locationId) } }
    ] : []),
    
    { $lookup: { from: 'warehouses', localField: 'warehouse', foreignField: '_id', as: '_warehouse' } },
    { $addFields: { warehouse: { $arrayElemAt: ['$_warehouse', 0] } } },
    { $project: { _warehouse: 0 } },
    { $sort: { createdAt: -1 } },
    { $facet: {
      adjustments: [{ $skip: skip }, { $limit: limit }],
      meta:        [{ $count: 'total' }],
    }},
  ];

  const [result] = await StockAdjustment.aggregate(pipeline);
  return { adjustments: result.adjustments, total: result.meta[0]?.total ?? 0, page, limit };
}

// ─── 7. Get single adjustment (fully populated) ───────────────────────────────

async function getAdjustmentById(id) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid adjustment id', 'INVALID_ID');

  const adjustment = await StockAdjustment.findById(id)
    .populate('warehouse',      'name code address')
    .populate('createdBy',      'name email')
    .populate('validatedBy',    'name email')
    .populate('lines.product',  'name sku unitOfMeasure')
    .populate('lines.location', 'name type');

  if (!adjustment) throw notFound('Adjustment not found');
  return adjustment;
}

module.exports = {
  createAdjustment,
  addLine,
  removeLine,
  countLine,
  validateAdjustment,
  cancelAdjustment,
  listAdjustments,
  getAdjustmentById,
};
