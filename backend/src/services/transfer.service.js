'use strict';

const mongoose          = require('mongoose');
const InternalTransfer  = require('../models/InternalTransfer');
const Product           = require('../models/Product');
const Warehouse         = require('../models/Warehouse');
const Location          = require('../models/Location');
const StockQuantity     = require('../models/StockQuantity');
const StockLedger       = require('../models/StockLedger');
const { DOC_STATUS }    = require('../constants/status');
const MOVEMENT_TYPES    = require('../constants/movementTypes');
const { generateDocNumber } = require('../utils/generateNumber');
const notificationService = require('./notification.service');

// ─── Error factories ──────────────────────────────────────────────────────────

const mkErr      = (msg, code, status) => Object.assign(new Error(msg), { code, status });
const notFound   = (msg)               => mkErr(msg, 'NOT_FOUND',   404);
const badRequest = (msg, code)         => mkErr(msg, code || 'BAD_REQUEST', 400);
const conflict   = (msg, code)         => mkErr(msg, code || 'CONFLICT',    409);

// ─── Per-line validation helper ───────────────────────────────────────────────

/**
 * Validate every transfer line:
 * - product exists + active
 * - sourceWarehouse / destinationWarehouse exist + active
 * - sourceLocation belongs to sourceWarehouse
 * - destinationLocation belongs to destinationWarehouse
 * - sourceLocation !== destinationLocation
 * - quantity > 0
 */
async function assertLines(lines) {
  for (const line of lines) {
    // Product
    const product = await Product.findById(line.product);
    if (!product)          throw notFound(`Product not found: ${line.product}`);
    if (!product.isActive) throw badRequest(`Product is inactive: ${product.name}`, 'PRODUCT_INACTIVE');

    // Source warehouse
    const srcWH = await Warehouse.findById(line.sourceWarehouse);
    if (!srcWH)          throw notFound(`Source warehouse not found: ${line.sourceWarehouse}`);
    if (!srcWH.isActive) throw badRequest(`Source warehouse is inactive: ${srcWH.name}`, 'WAREHOUSE_INACTIVE');

    // Destination warehouse
    const dstWH = await Warehouse.findById(line.destinationWarehouse);
    if (!dstWH)          throw notFound(`Destination warehouse not found: ${line.destinationWarehouse}`);
    if (!dstWH.isActive) throw badRequest(`Destination warehouse is inactive: ${dstWH.name}`, 'WAREHOUSE_INACTIVE');

    // Source location
    const srcLoc = await Location.findById(line.sourceLocation);
    if (!srcLoc)          throw notFound(`Source location not found: ${line.sourceLocation}`);
    if (!srcLoc.isActive) throw badRequest(`Source location is inactive: ${srcLoc.name}`, 'LOCATION_INACTIVE');
    if (srcLoc.warehouse.toString() !== line.sourceWarehouse.toString()) {
      throw badRequest(
        `Source location "${srcLoc.name}" does not belong to the specified source warehouse`,
        'LOCATION_WAREHOUSE_MISMATCH'
      );
    }

    // Destination location
    const dstLoc = await Location.findById(line.destinationLocation);
    if (!dstLoc)          throw notFound(`Destination location not found: ${line.destinationLocation}`);
    if (!dstLoc.isActive) throw badRequest(`Destination location is inactive: ${dstLoc.name}`, 'LOCATION_INACTIVE');
    if (dstLoc.warehouse.toString() !== line.destinationWarehouse.toString()) {
      throw badRequest(
        `Destination location "${dstLoc.name}" does not belong to the specified destination warehouse`,
        'LOCATION_WAREHOUSE_MISMATCH'
      );
    }

    // Source and destination must differ
    if (line.sourceLocation.toString() === line.destinationLocation.toString()) {
      throw badRequest(
        `Source and destination location cannot be the same (product: ${product.name})`,
        'SAME_LOCATION'
      );
    }
  }
}

/** Reject edits to done/canceled transfers */
function assertEditable(transfer) {
  if ([DOC_STATUS.DONE, DOC_STATUS.CANCELED].includes(transfer.status)) {
    throw conflict(
      `Transfer ${transfer.transferNumber} is ${transfer.status} and cannot be modified`,
      'TRANSFER_IMMUTABLE'
    );
  }
}

/**
 * Derive status from line confirmed flags:
 *   - all confirmed → ready
 *   - any confirmed → waiting
 *   - none          → draft
 */
function deriveStatus(lines) {
  if (!lines.length)               return DOC_STATUS.DRAFT;
  if (lines.every((l) => l.confirmed)) return DOC_STATUS.READY;
  if (lines.some((l) => l.confirmed))  return DOC_STATUS.WAITING;
  return DOC_STATUS.DRAFT;
}

// ─── 1. Create ────────────────────────────────────────────────────────────────

async function createTransfer({ scheduledDate, lines }, createdBy) {
  if (lines?.length) await assertLines(lines);

  const transferNumber = await generateDocNumber('TRF');

  const formattedLines = (lines || []).map((l) => ({
    product:              l.product,
    quantity:             l.quantity,
    sourceWarehouse:      l.sourceWarehouse,
    sourceLocation:       l.sourceLocation,
    destinationWarehouse: l.destinationWarehouse,
    destinationLocation:  l.destinationLocation,
    confirmed:            false,
  }));

  const transfer = await InternalTransfer.create({
    transferNumber,
    scheduledDate: scheduledDate || null,
    status:    DOC_STATUS.DRAFT,
    lines:     formattedLines,
    createdBy,
  });

  return transfer;
}

// ─── 2. Update (header + lines replacement) ───────────────────────────────────

async function updateTransfer(id, updates) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid transfer id', 'INVALID_ID');

  const transfer = await InternalTransfer.findById(id);
  if (!transfer) throw notFound('Transfer not found');
  assertEditable(transfer);

  if (updates.lines?.length) await assertLines(updates.lines);

  if (updates.scheduledDate !== undefined) transfer.scheduledDate = updates.scheduledDate;

  if (updates.lines) {
    transfer.lines = updates.lines.map((l) => ({
      product:              l.product,
      quantity:             l.quantity,
      sourceWarehouse:      l.sourceWarehouse,
      sourceLocation:       l.sourceLocation,
      destinationWarehouse: l.destinationWarehouse,
      destinationLocation:  l.destinationLocation,
      confirmed:            false,
    }));
    transfer.status = deriveStatus(transfer.lines);
  }

  await transfer.save();
  return transfer;
}

// ─── 3a. Add a single line ────────────────────────────────────────────────────

async function addLine(id, lineData) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid transfer id', 'INVALID_ID');

  const transfer = await InternalTransfer.findById(id);
  if (!transfer) throw notFound('Transfer not found');
  assertEditable(transfer);

  await assertLines([lineData]);

  transfer.lines.push({
    product:              lineData.product,
    quantity:             lineData.quantity,
    sourceWarehouse:      lineData.sourceWarehouse,
    sourceLocation:       lineData.sourceLocation,
    destinationWarehouse: lineData.destinationWarehouse,
    destinationLocation:  lineData.destinationLocation,
    confirmed:            false,
  });

  transfer.status = deriveStatus(transfer.lines);
  await transfer.save();
  return transfer;
}

// ─── 3b. Remove a line ────────────────────────────────────────────────────────

async function removeLine(id, lineId) {
  if (!mongoose.isValidObjectId(id))     throw badRequest('Invalid transfer id', 'INVALID_ID');
  if (!mongoose.isValidObjectId(lineId)) throw badRequest('Invalid line id', 'INVALID_ID');

  const transfer = await InternalTransfer.findById(id);
  if (!transfer) throw notFound('Transfer not found');
  assertEditable(transfer);

  const idx = transfer.lines.findIndex((l) => l._id.toString() === lineId);
  if (idx === -1) throw notFound('Line not found on this transfer');

  transfer.lines.splice(idx, 1);
  transfer.status = deriveStatus(transfer.lines);
  await transfer.save();
  return transfer;
}

// ─── 4. Confirm a line ────────────────────────────────────────────────────────

async function confirmLine(id, lineId) {
  if (!mongoose.isValidObjectId(id))     throw badRequest('Invalid transfer id', 'INVALID_ID');
  if (!mongoose.isValidObjectId(lineId)) throw badRequest('Invalid line id', 'INVALID_ID');

  const transfer = await InternalTransfer.findById(id);
  if (!transfer) throw notFound('Transfer not found');
  assertEditable(transfer);

  const line = transfer.lines.find((l) => l._id.toString() === lineId);
  if (!line) throw notFound('Line not found on this transfer');

  // Availability check — same pattern as delivery pickLine
  const sq = await StockQuantity.findOne({
    product:  line.product,
    location: line.sourceLocation,
  }).populate('location', 'name').populate('product', 'name sku');

  const available = sq?.quantityAvailable ?? 0;
  if (line.quantity > available) {
    const locName  = sq?.location?.name    ?? line.sourceLocation.toString();
    const prodName = sq?.product?.name     ?? line.product.toString();
    throw conflict(
      `Insufficient stock: "${prodName}" has only ${available} available at "${locName}", ` +
      `cannot transfer ${line.quantity}`,
      'INSUFFICIENT_STOCK'
    );
  }

  line.confirmed  = true;
  transfer.status = deriveStatus(transfer.lines);
  await transfer.save();
  return transfer;
}

// ─── 5. Validate → double-entry ledger (transactional) ───────────────────────

/**
 * Core stock-relocation step.
 * Each line produces TWO ledger entries (transfer_out + transfer_in) and
 * touches TWO StockQuantity rows. Total company-wide stock is unchanged.
 *
 * Mirrors receiptService.validateReceipt / deliveryOrderService.validateDeliveryOrder
 * in structure so all three Operations modules follow the same code shape.
 *
 * @param {string} transferId
 * @param {string} userId
 * @returns {{ transfer, stockChanges }}
 */
async function validateTransfer(transferId, userId) {
  if (!mongoose.isValidObjectId(transferId))
    throw badRequest('Invalid transfer id', 'INVALID_ID');

  const transfer = await InternalTransfer.findById(transferId);
  if (!transfer) throw notFound('Transfer not found');

  if ([DOC_STATUS.DONE, DOC_STATUS.CANCELED].includes(transfer.status)) {
    throw conflict(
      `Transfer is already ${transfer.status} and cannot be validated`,
      'TRANSFER_IMMUTABLE'
    );
  }

  if (!transfer.lines.length) {
    throw badRequest('Cannot validate a transfer with no lines', 'NO_LINES');
  }

  // ── Pre-flight availability check across ALL lines ────────────────────────
  // Done outside the transaction so we can report every shortfall at once.
  const shortfalls = [];
  for (const line of transfer.lines) {
    const sq = await StockQuantity.findOne({
      product:  line.product,
      location: line.sourceLocation,
    })
      .populate('location', 'name')
      .populate('product',  'name sku');

    const available = sq?.quantityAvailable ?? 0;
    if (line.quantity > available) {
      shortfalls.push({
        product:   sq?.product?.name ?? line.product.toString(),
        sku:       sq?.product?.sku  ?? '',
        location:  sq?.location?.name ?? line.sourceLocation.toString(),
        requested: line.quantity,
        available,
      });
    }
  }

  if (shortfalls.length) {
    const detail = shortfalls
      .map((s) => `${s.product} (${s.sku}) at "${s.location}": need ${s.requested}, have ${s.available}`)
      .join('; ');
    throw conflict(
      `Validation aborted — insufficient stock for ${shortfalls.length} line(s): ${detail}`,
      'INSUFFICIENT_STOCK'
    );
  }

  // ── Transactional double-entry writes ─────────────────────────────────────
  const now          = new Date();
  const stockChanges = [];

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const line of transfer.lines) {
        // ── SOURCE: decrement ────────────────────────────────────────────────
        const srcSQ = await StockQuantity.findOneAndUpdate(
          { product: line.product, location: line.sourceLocation },
          {
            $inc: {
              quantityOnHand:    -line.quantity,
              quantityAvailable: -line.quantity,
            },
            $set: { lastMovementAt: now },
          },
          { new: true, session }
        );

        // StockLedger: transfer_out (negative)
        await StockLedger.create(
          [{
            product:        line.product,
            warehouse:      line.sourceWarehouse,
            location:       line.sourceLocation,
            movementType:   MOVEMENT_TYPES.TRANSFER_OUT,
            quantityChange: -line.quantity,
            balanceAfter:   srcSQ.quantityOnHand,
            reference: {
              docType:   'InternalTransfer',
              docId:     transfer._id,
              docNumber: transfer.transferNumber,
            },
            performedBy: userId,
            timestamp:   now,
          }],
          { session }
        );

        // ── DESTINATION: increment (upsert — row may not exist yet) ──────────
        const dstSQ = await StockQuantity.findOneAndUpdate(
          { product: line.product, location: line.destinationLocation },
          {
            $inc: {
              quantityOnHand:    line.quantity,
              quantityAvailable: line.quantity,
            },
            $set: {
              warehouse:       line.destinationWarehouse,
              lastMovementAt:  now,
            },
          },
          {
            upsert:              true,
            new:                 true,
            session,
            setDefaultsOnInsert: true,
          }
        );

        // StockLedger: transfer_in (positive)
        await StockLedger.create(
          [{
            product:        line.product,
            warehouse:      line.destinationWarehouse,
            location:       line.destinationLocation,
            movementType:   MOVEMENT_TYPES.TRANSFER_IN,
            quantityChange: line.quantity,
            balanceAfter:   dstSQ.quantityOnHand,
            reference: {
              docType:   'InternalTransfer',
              docId:     transfer._id,
              docNumber: transfer.transferNumber,
            },
            performedBy: userId,
            timestamp:   now,
          }],
          { session }
        );

        stockChanges.push({
          product:          line.product,
          sourceLocation:   line.sourceLocation,
          destLocation:     line.destinationLocation,
          quantity:         line.quantity,
          newSourceBalance: srcSQ.quantityOnHand,
          newDestBalance:   dstSQ.quantityOnHand,
          // Net change to total company stock = 0 (by design)
          netStockChange:   0,
        });
      }

      // Stamp the transfer as done
      await InternalTransfer.updateOne(
        { _id: transfer._id },
        {
          $set: {
            status:      DOC_STATUS.DONE,
            validatedAt: now,
            validatedBy: userId,
          },
        },
        { session }
      );
    });
  } finally {
    session.endSession();
  }

  // Reload fully populated for the response
  const updated = await InternalTransfer.findById(transferId)
    .populate('createdBy',                        'name email')
    .populate('validatedBy',                      'name email')
    .populate('lines.product',                    'name sku unitOfMeasure')
    .populate('lines.sourceWarehouse',            'name code')
    .populate('lines.sourceLocation',             'name type')
    .populate('lines.destinationWarehouse',       'name code')
    .populate('lines.destinationLocation',        'name type');

  // Notify operation completion
  notificationService.notifyOperationCompleted(
    'Transfer',
    updated._id,
    updated.transferNumber,
    updated.lines[0]?.sourceWarehouse?._id || transfer.lines[0]?.sourceWarehouse
  ).catch(err => console.error('Notification error:', err));

  // Check stock levels for both source and destination warehouses
  for (const line of transfer.lines) {
    // Check source warehouse (may trigger low stock alerts after removal)
    notificationService.checkStockLevels(
      line.product,
      line.sourceWarehouse
    ).catch(err => console.error('Stock check error:', err));

    // Check destination warehouse (stock increase, less likely to trigger alerts)
    notificationService.checkStockLevels(
      line.product,
      line.destinationWarehouse
    ).catch(err => console.error('Stock check error:', err));
  }

  return { transfer: updated, stockChanges };
}

// ─── 6. Cancel ────────────────────────────────────────────────────────────────

async function cancelTransfer(id) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid transfer id', 'INVALID_ID');

  const transfer = await InternalTransfer.findById(id);
  if (!transfer) throw notFound('Transfer not found');

  if (transfer.status === DOC_STATUS.DONE) {
    throw conflict(
      'A validated transfer cannot be canceled — use a Stock Adjustment to correct stock',
      'TRANSFER_DONE'
    );
  }
  if (transfer.status === DOC_STATUS.CANCELED) {
    throw conflict('Transfer is already canceled', 'ALREADY_CANCELED');
  }

  transfer.status = DOC_STATUS.CANCELED;
  await transfer.save();
  return transfer;
}

// ─── 7. List ─────────────────────────────────────────────────────────────────

async function listTransfers({ status, warehouse, category, dateFrom, dateTo, page, limit }) {
  const { buildCategoryStages } = require('../utils/categoryPipeline');

  const baseMatch = {};
  if (status) baseMatch.status = status;
  if (warehouse) {
    const wId = new mongoose.Types.ObjectId(warehouse);
    baseMatch.$or = [
      { 'lines.sourceWarehouse':      wId },
      { 'lines.destinationWarehouse': wId },
    ];
  }
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
    { $sort: { createdAt: -1 } },
    { $facet: {
      transfers: [{ $skip: skip }, { $limit: limit }],
      meta:      [{ $count: 'total' }],
    }},
  ];

  const [result] = await InternalTransfer.aggregate(pipeline);
  return { transfers: result.transfers, total: result.meta[0]?.total ?? 0, page, limit };
}

// ─── 8. Get single transfer (fully populated) ─────────────────────────────────

async function getTransferById(id) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid transfer id', 'INVALID_ID');

  const transfer = await InternalTransfer.findById(id)
    .populate('createdBy',                  'name email')
    .populate('validatedBy',                'name email')
    .populate('lines.product',              'name sku unitOfMeasure')
    .populate('lines.sourceWarehouse',      'name code')
    .populate('lines.sourceLocation',       'name type')
    .populate('lines.destinationWarehouse', 'name code')
    .populate('lines.destinationLocation',  'name type');

  if (!transfer) throw notFound('Transfer not found');
  return transfer;
}

// ─── 9. Scheduled count (Dashboard KPI) ──────────────────────────────────────

async function getScheduledCount() {
  return InternalTransfer.countDocuments({
    status: { $in: [DOC_STATUS.DRAFT, DOC_STATUS.WAITING, DOC_STATUS.READY] },
  });
}

module.exports = {
  createTransfer,
  updateTransfer,
  addLine,
  removeLine,
  confirmLine,
  validateTransfer,
  cancelTransfer,
  listTransfers,
  getTransferById,
  getScheduledCount,
};
