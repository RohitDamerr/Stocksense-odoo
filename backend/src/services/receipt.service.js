'use strict';

const mongoose      = require('mongoose');
const Receipt       = require('../models/Receipt');
const Product       = require('../models/Product');
const Supplier      = require('../models/Supplier');
const Warehouse     = require('../models/Warehouse');
const Location      = require('../models/Location');
const StockQuantity = require('../models/StockQuantity');
const StockLedger   = require('../models/StockLedger');
const { DOC_STATUS } = require('../constants/status');
const MOVEMENT_TYPES = require('../constants/movementTypes');
const { generateDocNumber } = require('../utils/generateNumber');
const notificationService = require('./notification.service');

// ─── Shared error factories ───────────────────────────────────────────────────

const err = (msg, code, status) => Object.assign(new Error(msg), { code, status });

const notFound   = (msg)        => err(msg, 'NOT_FOUND',   404);
const badRequest = (msg, code)  => err(msg, code || 'BAD_REQUEST', 400);
const conflict   = (msg, code)  => err(msg, code || 'CONFLICT',    409);

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Verify supplier exists and is active.
 */
async function assertSupplier(id) {
  const doc = await Supplier.findById(id);
  if (!doc)           throw notFound('Supplier not found');
  if (!doc.isActive)  throw badRequest('Supplier is inactive', 'SUPPLIER_INACTIVE');
  return doc;
}

/**
 * Verify warehouse exists and is active.
 */
async function assertWarehouse(id) {
  const doc = await Warehouse.findById(id);
  if (!doc)          throw notFound('Warehouse not found');
  if (!doc.isActive) throw badRequest('Warehouse is inactive', 'WAREHOUSE_INACTIVE');
  return doc;
}

/**
 * Validate every line's product and destinationLocation.
 * - product must exist and be active
 * - destinationLocation must exist, be active, and belong to warehouseId
 *
 * @param {Array}  lines
 * @param {string} warehouseId
 * @returns {Promise<void>}
 */
async function assertLines(lines, warehouseId) {
  for (const line of lines) {
    const product = await Product.findById(line.product);
    if (!product)          throw notFound(`Product not found: ${line.product}`);
    if (!product.isActive) throw badRequest(`Product is inactive: ${product.name}`, 'PRODUCT_INACTIVE');

    const location = await Location.findById(line.destinationLocation);
    if (!location)          throw notFound(`Location not found: ${line.destinationLocation}`);
    if (!location.isActive) throw badRequest(`Location is inactive: ${location.name}`, 'LOCATION_INACTIVE');

    if (location.warehouse.toString() !== warehouseId.toString()) {
      throw badRequest(
        `Location "${location.name}" does not belong to the specified warehouse`,
        'LOCATION_WAREHOUSE_MISMATCH'
      );
    }
  }
}

/**
 * Guard: receipt must be in an editable state.
 */
function assertEditable(receipt) {
  if ([DOC_STATUS.DONE, DOC_STATUS.CANCELED].includes(receipt.status)) {
    throw conflict(
      `Receipt ${receipt.receiptNumber} is ${receipt.status} and cannot be modified`,
      'RECEIPT_IMMUTABLE'
    );
  }
}

/**
 * Derive status transition after quantity entry:
 *   - any receivedQty > 0          → at least "waiting"
 *   - every receivedQty >= expectedQty → "ready"
 *   - no receivedQty > 0            → stays "draft"
 */
function deriveStatus(lines) {
  if (!lines.length) return DOC_STATUS.DRAFT;
  const anyReceived  = lines.some((l) => l.receivedQty > 0);
  const allSatisfied = lines.every((l) => l.receivedQty >= l.expectedQty);
  if (allSatisfied) return DOC_STATUS.READY;
  if (anyReceived)  return DOC_STATUS.WAITING;
  return DOC_STATUS.DRAFT;
}

// ─── 1. Create ────────────────────────────────────────────────────────────────

async function createReceipt({ supplier, destinationWarehouse, scheduledDate, lines }, createdBy) {
  await assertSupplier(supplier);
  await assertWarehouse(destinationWarehouse);
  if (lines?.length) await assertLines(lines, destinationWarehouse);

  const receiptNumber = await generateDocNumber('RCV');

  const formattedLines = (lines || []).map((l) => ({
    product:             l.product,
    expectedQty:         l.expectedQty,
    receivedQty:         0,
    destinationLocation: l.destinationLocation,
  }));

  const receipt = await Receipt.create({
    receiptNumber,
    supplier,
    destinationWarehouse,
    scheduledDate: scheduledDate || null,
    status:  DOC_STATUS.DRAFT,
    lines:   formattedLines,
    createdBy,
  });

  return receipt;
}

// ─── 2. Update header / lines ─────────────────────────────────────────────────

async function updateReceipt(id, updates) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid receipt id', 'INVALID_ID');

  const receipt = await Receipt.findById(id);
  if (!receipt) throw notFound('Receipt not found');
  assertEditable(receipt);

  const warehouseId = updates.destinationWarehouse || receipt.destinationWarehouse;

  if (updates.supplier)             await assertSupplier(updates.supplier);
  if (updates.destinationWarehouse) await assertWarehouse(updates.destinationWarehouse);
  if (updates.lines?.length)        await assertLines(updates.lines, warehouseId);

  if (updates.supplier)             receipt.supplier             = updates.supplier;
  if (updates.destinationWarehouse) receipt.destinationWarehouse = updates.destinationWarehouse;
  if (updates.scheduledDate !== undefined) receipt.scheduledDate = updates.scheduledDate;

  if (updates.lines) {
    receipt.lines = updates.lines.map((l) => ({
      product:             l.product,
      expectedQty:         l.expectedQty,
      receivedQty:         l.receivedQty ?? 0,
      destinationLocation: l.destinationLocation,
    }));
    receipt.status = deriveStatus(receipt.lines);
  }

  await receipt.save();
  return receipt;
}

// ─── 3a. Add a single line ────────────────────────────────────────────────────

async function addLine(id, lineData) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid receipt id', 'INVALID_ID');

  const receipt = await Receipt.findById(id);
  if (!receipt) throw notFound('Receipt not found');
  assertEditable(receipt);

  await assertLines([lineData], receipt.destinationWarehouse);

  receipt.lines.push({
    product:             lineData.product,
    expectedQty:         lineData.expectedQty,
    receivedQty:         0,
    destinationLocation: lineData.destinationLocation,
  });

  receipt.status = deriveStatus(receipt.lines);
  await receipt.save();
  return receipt;
}

// ─── 3b. Remove a line ────────────────────────────────────────────────────────

async function removeLine(id, lineId) {
  if (!mongoose.isValidObjectId(id))     throw badRequest('Invalid receipt id', 'INVALID_ID');
  if (!mongoose.isValidObjectId(lineId)) throw badRequest('Invalid line id', 'INVALID_ID');

  const receipt = await Receipt.findById(id);
  if (!receipt) throw notFound('Receipt not found');
  assertEditable(receipt);

  const idx = receipt.lines.findIndex((l) => l._id.toString() === lineId);
  if (idx === -1) throw notFound('Line not found on this receipt');

  receipt.lines.splice(idx, 1);
  receipt.status = deriveStatus(receipt.lines);
  await receipt.save();
  return receipt;
}

// ─── 4. Input received quantity ───────────────────────────────────────────────

async function receiveQty(id, lineId, receivedQty) {
  if (!mongoose.isValidObjectId(id))     throw badRequest('Invalid receipt id', 'INVALID_ID');
  if (!mongoose.isValidObjectId(lineId)) throw badRequest('Invalid line id', 'INVALID_ID');

  const receipt = await Receipt.findById(id);
  if (!receipt) throw notFound('Receipt not found');
  assertEditable(receipt);

  const line = receipt.lines.find((l) => l._id.toString() === lineId);
  if (!line) throw notFound('Line not found on this receipt');

  line.receivedQty = receivedQty;
  receipt.status   = deriveStatus(receipt.lines);

  await receipt.save();
  return receipt;
}

// ─── 5. Validate → stock increases (transactional) ───────────────────────────

/**
 * The core stock-increasing step.
 * Isolated as a named export so Delivery and Adjustment modules can follow
 * the same structural pattern.
 *
 * @param {string} receiptId
 * @param {string} userId
 * @returns {{ receipt, stockChanges }}
 */
async function validateReceipt(receiptId, userId) {
  if (!mongoose.isValidObjectId(receiptId)) throw badRequest('Invalid receipt id', 'INVALID_ID');

  // Pre-flight read outside transaction
  const receipt = await Receipt.findById(receiptId);
  if (!receipt) throw notFound('Receipt not found');

  if ([DOC_STATUS.DONE, DOC_STATUS.CANCELED].includes(receipt.status)) {
    throw conflict(
      `Receipt is already ${receipt.status} and cannot be validated`,
      'RECEIPT_IMMUTABLE'
    );
  }

  const linesWithQty = receipt.lines.filter((l) => l.receivedQty > 0);
  if (!linesWithQty.length) {
    throw badRequest(
      'Cannot validate: no line has a receivedQty greater than 0',
      'NO_QUANTITIES'
    );
  }

  const now         = new Date();
  const stockChanges = [];

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const line of linesWithQty) {
        // Upsert StockQuantity — $inc keeps the operation idempotent if retried
        const updatedSQ = await StockQuantity.findOneAndUpdate(
          {
            product:  line.product,
            location: line.destinationLocation,
          },
          {
            $inc: {
              quantityOnHand:    line.receivedQty,
              quantityAvailable: line.receivedQty,
            },
            $set: {
              warehouse:       receipt.destinationWarehouse,
              lastMovementAt:  now,
            },
          },
          {
            upsert:  true,
            new:     true,
            session,
            // Ensure the doc is initialised to 0 before the $inc if it's new
            setDefaultsOnInsert: true,
          }
        );

        // Insert immutable ledger entry
        await StockLedger.create(
          [{
            product:        line.product,
            warehouse:      receipt.destinationWarehouse,
            location:       line.destinationLocation,
            movementType:   MOVEMENT_TYPES.RECEIPT,
            quantityChange: line.receivedQty,
            balanceAfter:   updatedSQ.quantityOnHand,
            reference: {
              docType:   'Receipt',
              docId:     receipt._id,
              docNumber: receipt.receiptNumber,
            },
            performedBy: userId,
            timestamp:   now,
          }],
          { session }
        );

        stockChanges.push({
          product:      line.product,
          location:     line.destinationLocation,
          qtyAdded:     line.receivedQty,
          newBalance:   updatedSQ.quantityOnHand,
        });
      }

      // Stamp the receipt as done
      await Receipt.updateOne(
        { _id: receipt._id },
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

  // Reload for the response — outside the session
  const updated = await Receipt.findById(receiptId)
    .populate('supplier',             'name contactPerson email phone')
    .populate('destinationWarehouse', 'name code')
    .populate('createdBy',            'name email')
    .populate('validatedBy',          'name email')
    .populate('lines.product',        'name sku unitOfMeasure')
    .populate('lines.destinationLocation', 'name type');

  // Notify operation completion and check stock levels
  notificationService.notifyOperationCompleted(
    'Receipt',
    updated._id,
    updated.receiptNumber,
    updated.destinationWarehouse._id
  ).catch(err => console.error('Notification error:', err));

  // Check stock levels for all products in the receipt
  for (const line of linesWithQty) {
    notificationService.checkStockLevels(
      line.product,
      receipt.destinationWarehouse
    ).catch(err => console.error('Stock check error:', err));
  }

  return { receipt: updated, stockChanges };
}

// ─── 6. Cancel ────────────────────────────────────────────────────────────────

async function cancelReceipt(id) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid receipt id', 'INVALID_ID');

  const receipt = await Receipt.findById(id);
  if (!receipt) throw notFound('Receipt not found');

  if (receipt.status === DOC_STATUS.DONE) {
    throw conflict(
      'A validated receipt cannot be canceled — create a Stock Adjustment to reverse the stock',
      'RECEIPT_DONE'
    );
  }
  if (receipt.status === DOC_STATUS.CANCELED) {
    throw conflict('Receipt is already canceled', 'ALREADY_CANCELED');
  }

  receipt.status = DOC_STATUS.CANCELED;
  await receipt.save();
  return receipt;
}

// ─── 7. List ──────────────────────────────────────────────────────────────────

async function listReceipts({ status, destinationWarehouse, supplier, category, dateFrom, dateTo, page, limit }) {
  const { buildCategoryStages } = require('../utils/categoryPipeline');

  // Base $match — all non-category filters applied here (uses existing indexes)
  const baseMatch = {};
  if (status)               baseMatch.status               = status;
  if (destinationWarehouse) baseMatch.destinationWarehouse = new mongoose.Types.ObjectId(destinationWarehouse);
  if (supplier)             baseMatch.supplier             = new mongoose.Types.ObjectId(supplier);
  if (dateFrom || dateTo) {
    baseMatch.createdAt = {};
    if (dateFrom) baseMatch.createdAt.$gte = new Date(dateFrom);
    if (dateTo)   baseMatch.createdAt.$lte = new Date(dateTo);
  }

  // Category stages — empty array when no category filter
  const categoryStages = await buildCategoryStages(category);
  if (categoryStages === null) {
    const e = new Error('Category not found'); e.code = 'NOT_FOUND'; e.status = 404; throw e;
  }

  const skip = (page - 1) * limit;

  const pipeline = [
    { $match: baseMatch },
    ...categoryStages,
    // $lookup supplier + warehouse names for the list view
    { $lookup: { from: 'suppliers',  localField: 'supplier',             foreignField: '_id', as: '_supplier'  } },
    { $lookup: { from: 'warehouses', localField: 'destinationWarehouse', foreignField: '_id', as: '_warehouse' } },
    { $addFields: {
      supplier:             { $arrayElemAt: ['$_supplier',  0] },
      destinationWarehouse: { $arrayElemAt: ['$_warehouse', 0] },
    }},
    { $project: { _supplier: 0, _warehouse: 0 } },
    { $sort: { createdAt: -1 } },
    { $facet: {
      receipts: [{ $skip: skip }, { $limit: limit }],
      meta:     [{ $count: 'total' }],
    }},
  ];

  const [result] = await Receipt.aggregate(pipeline);
  return { receipts: result.receipts, total: result.meta[0]?.total ?? 0, page, limit };
}

// ─── 8. Get single receipt (fully populated) ──────────────────────────────────

async function getReceiptById(id) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid receipt id', 'INVALID_ID');

  const receipt = await Receipt.findById(id)
    .populate('supplier',             'name contactPerson email phone address')
    .populate('destinationWarehouse', 'name code address')
    .populate('createdBy',            'name email')
    .populate('validatedBy',          'name email')
    .populate('lines.product',        'name sku unitOfMeasure')
    .populate('lines.destinationLocation', 'name type');

  if (!receipt) throw notFound('Receipt not found');
  return receipt;
}

// ─── 9. Pending count (Dashboard KPI) ────────────────────────────────────────

async function getPendingCount() {
  return Receipt.countDocuments({
    status: { $in: [DOC_STATUS.DRAFT, DOC_STATUS.WAITING, DOC_STATUS.READY] },
  });
}

module.exports = {
  createReceipt,
  updateReceipt,
  addLine,
  removeLine,
  receiveQty,
  validateReceipt,
  cancelReceipt,
  listReceipts,
  getReceiptById,
  getPendingCount,
};
