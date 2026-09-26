'use strict';

const mongoose       = require('mongoose');
const DeliveryOrder  = require('../models/DeliveryOrder');
const Product        = require('../models/Product');
const Warehouse      = require('../models/Warehouse');
const Location       = require('../models/Location');
const StockQuantity  = require('../models/StockQuantity');
const StockLedger    = require('../models/StockLedger');
const { DOC_STATUS } = require('../constants/status');
const MOVEMENT_TYPES = require('../constants/movementTypes');
const { generateDocNumber } = require('../utils/generateNumber');
const notificationService = require('./notification.service');

// ─── Error factories ──────────────────────────────────────────────────────────

const mkErr      = (msg, code, status) => Object.assign(new Error(msg), { code, status });
const notFound   = (msg)               => mkErr(msg, 'NOT_FOUND',   404);
const badRequest = (msg, code)         => mkErr(msg, code || 'BAD_REQUEST', 400);
const conflict   = (msg, code)         => mkErr(msg, code || 'CONFLICT',    409);

// ─── Shared guard helpers ─────────────────────────────────────────────────────

async function assertWarehouse(id) {
  const doc = await Warehouse.findById(id);
  if (!doc)          throw notFound('Warehouse not found');
  if (!doc.isActive) throw badRequest('Warehouse is inactive', 'WAREHOUSE_INACTIVE');
  return doc;
}

/**
 * Validate delivery lines:
 * - product exists + active
 * - sourceLocation exists + active + belongs to warehouseId
 */
async function assertLines(lines, warehouseId) {
  for (const line of lines) {
    const product = await Product.findById(line.product);
    if (!product)          throw notFound(`Product not found: ${line.product}`);
    if (!product.isActive) throw badRequest(`Product is inactive: ${product.name}`, 'PRODUCT_INACTIVE');

    const location = await Location.findById(line.sourceLocation);
    if (!location)          throw notFound(`Location not found: ${line.sourceLocation}`);
    if (!location.isActive) throw badRequest(`Location is inactive: ${location.name}`, 'LOCATION_INACTIVE');

    if (location.warehouse.toString() !== warehouseId.toString()) {
      throw badRequest(
        `Location "${location.name}" does not belong to the specified warehouse`,
        'LOCATION_WAREHOUSE_MISMATCH'
      );
    }
  }
}

/** Reject writes to done/canceled orders */
function assertEditable(order) {
  if ([DOC_STATUS.DONE, DOC_STATUS.CANCELED].includes(order.status)) {
    throw conflict(
      `Delivery order ${order.deliveryNumber} is ${order.status} and cannot be modified`,
      'ORDER_IMMUTABLE'
    );
  }
}

/**
 * Auto-derive status from line quantities:
 *   - all lines: packedQty === orderedQty → ready
 *   - any line:  pickedQty > 0            → waiting
 *   - otherwise                           → draft
 */
function deriveStatus(lines) {
  if (!lines.length) return DOC_STATUS.DRAFT;
  const allFullyPacked = lines.every((l) => l.packedQty > 0 && l.packedQty === l.orderedQty);
  if (allFullyPacked) return DOC_STATUS.READY;
  const anyPicked = lines.some((l) => l.pickedQty > 0);
  if (anyPicked) return DOC_STATUS.WAITING;
  return DOC_STATUS.DRAFT;
}

// ─── 1. Create ────────────────────────────────────────────────────────────────

async function createDeliveryOrder({ customer, sourceWarehouse, scheduledDate, lines }, createdBy) {
  await assertWarehouse(sourceWarehouse);
  if (lines?.length) await assertLines(lines, sourceWarehouse);

  const deliveryNumber = await generateDocNumber('DEL');

  const formattedLines = (lines || []).map((l) => ({
    product:        l.product,
    orderedQty:     l.orderedQty,
    pickedQty:      0,
    packedQty:      0,
    sourceLocation: l.sourceLocation,
  }));

  const order = await DeliveryOrder.create({
    deliveryNumber,
    customer,
    sourceWarehouse,
    scheduledDate: scheduledDate || null,
    status:    DOC_STATUS.DRAFT,
    lines:     formattedLines,
    createdBy,
  });

  return order;
}

// ─── 2. Update header / replace lines ────────────────────────────────────────

async function updateDeliveryOrder(id, updates) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid delivery order id', 'INVALID_ID');

  const order = await DeliveryOrder.findById(id);
  if (!order) throw notFound('Delivery order not found');
  assertEditable(order);

  const warehouseId = updates.sourceWarehouse || order.sourceWarehouse;

  if (updates.sourceWarehouse) await assertWarehouse(updates.sourceWarehouse);
  if (updates.lines?.length)   await assertLines(updates.lines, warehouseId);

  if (updates.customer)        order.customer        = { ...order.customer.toObject(), ...updates.customer };
  if (updates.sourceWarehouse) order.sourceWarehouse = updates.sourceWarehouse;
  if (updates.scheduledDate !== undefined) order.scheduledDate = updates.scheduledDate;

  if (updates.lines) {
    order.lines = updates.lines.map((l) => ({
      product:        l.product,
      orderedQty:     l.orderedQty,
      pickedQty:      0,
      packedQty:      0,
      sourceLocation: l.sourceLocation,
    }));
    order.status = deriveStatus(order.lines);
  }

  await order.save();
  return order;
}

// ─── 3a. Add a single line ────────────────────────────────────────────────────

async function addLine(id, lineData) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid delivery order id', 'INVALID_ID');

  const order = await DeliveryOrder.findById(id);
  if (!order) throw notFound('Delivery order not found');
  assertEditable(order);

  await assertLines([lineData], order.sourceWarehouse);

  order.lines.push({
    product:        lineData.product,
    orderedQty:     lineData.orderedQty,
    pickedQty:      0,
    packedQty:      0,
    sourceLocation: lineData.sourceLocation,
  });

  order.status = deriveStatus(order.lines);
  await order.save();
  return order;
}

// ─── 3b. Remove a line ────────────────────────────────────────────────────────

async function removeLine(id, lineId) {
  if (!mongoose.isValidObjectId(id))     throw badRequest('Invalid delivery order id', 'INVALID_ID');
  if (!mongoose.isValidObjectId(lineId)) throw badRequest('Invalid line id', 'INVALID_ID');

  const order = await DeliveryOrder.findById(id);
  if (!order) throw notFound('Delivery order not found');
  assertEditable(order);

  const idx = order.lines.findIndex((l) => l._id.toString() === lineId);
  if (idx === -1) throw notFound('Line not found on this delivery order');

  order.lines.splice(idx, 1);
  order.status = deriveStatus(order.lines);
  await order.save();
  return order;
}

// ─── 4. Pick ──────────────────────────────────────────────────────────────────

async function pickLine(id, lineId, pickedQty) {
  if (!mongoose.isValidObjectId(id))     throw badRequest('Invalid delivery order id', 'INVALID_ID');
  if (!mongoose.isValidObjectId(lineId)) throw badRequest('Invalid line id', 'INVALID_ID');

  const order = await DeliveryOrder.findById(id);
  if (!order) throw notFound('Delivery order not found');
  assertEditable(order);

  const line = order.lines.find((l) => l._id.toString() === lineId);
  if (!line) throw notFound('Line not found on this delivery order');

  if (pickedQty > line.orderedQty) {
    throw badRequest(
      `Cannot pick ${pickedQty} — only ${line.orderedQty} ordered`,
      'PICK_EXCEEDS_ORDER'
    );
  }

  // ── Availability check ────────────────────────────────────────────────────
  const sq = await StockQuantity.findOne({
    product:  line.product,
    location: line.sourceLocation,
  }).populate('location', 'name');

  const available = sq?.quantityAvailable ?? 0;
  if (pickedQty > available) {
    const locationName = sq?.location?.name ?? line.sourceLocation.toString();
    throw conflict(
      `Insufficient stock: only ${available} available at "${locationName}", cannot pick ${pickedQty}`,
      'INSUFFICIENT_STOCK'
    );
  }

  line.pickedQty = pickedQty;
  order.status   = deriveStatus(order.lines);
  await order.save();
  return order;
}

// ─── 5. Pack ──────────────────────────────────────────────────────────────────

async function packLine(id, lineId, packedQty) {
  if (!mongoose.isValidObjectId(id))     throw badRequest('Invalid delivery order id', 'INVALID_ID');
  if (!mongoose.isValidObjectId(lineId)) throw badRequest('Invalid line id', 'INVALID_ID');

  const order = await DeliveryOrder.findById(id);
  if (!order) throw notFound('Delivery order not found');
  assertEditable(order);

  const line = order.lines.find((l) => l._id.toString() === lineId);
  if (!line) throw notFound('Line not found on this delivery order');

  if (packedQty > line.pickedQty) {
    throw badRequest(
      `Cannot pack ${packedQty} — only ${line.pickedQty} was picked`,
      'PACK_EXCEEDS_PICKED'
    );
  }

  line.packedQty = packedQty;
  order.status   = deriveStatus(order.lines);
  await order.save();
  return order;
}

// ─── 6. Validate → stock decreases (transactional) ───────────────────────────

/**
 * Core stock-decreasing step. Mirrors receiptService.validateReceipt structure.
 * Pre-validates availability across ALL lines before opening the transaction —
 * if any line would go negative, the whole operation is rejected before touching DB.
 *
 * @param {string} deliveryOrderId
 * @param {string} userId
 * @returns {{ order, stockChanges }}
 */
async function validateDeliveryOrder(deliveryOrderId, userId) {
  if (!mongoose.isValidObjectId(deliveryOrderId))
    throw badRequest('Invalid delivery order id', 'INVALID_ID');

  const order = await DeliveryOrder.findById(deliveryOrderId);
  if (!order) throw notFound('Delivery order not found');

  if ([DOC_STATUS.DONE, DOC_STATUS.CANCELED].includes(order.status)) {
    throw conflict(
      `Delivery order is already ${order.status} and cannot be validated`,
      'ORDER_IMMUTABLE'
    );
  }

  const linesWithQty = order.lines.filter((l) => l.packedQty > 0);
  if (!linesWithQty.length) {
    throw badRequest(
      'Cannot validate: no line has a packedQty greater than 0',
      'NO_QUANTITIES'
    );
  }

  // ── Pre-flight availability check (ALL lines before any write) ────────────
  const shortfalls = [];
  for (const line of linesWithQty) {
    const sq = await StockQuantity.findOne({
      product:  line.product,
      location: line.sourceLocation,
    }).populate('location', 'name').populate('product', 'name sku');

    const available = sq?.quantityAvailable ?? 0;
    if (line.packedQty > available) {
      shortfalls.push({
        product:   sq?.product?.name ?? line.product.toString(),
        sku:       sq?.product?.sku  ?? '',
        location:  sq?.location?.name ?? line.sourceLocation.toString(),
        requested: line.packedQty,
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

  // ── Transactional writes ─────────────────────────────────────────────────
  const now         = new Date();
  const stockChanges = [];

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const line of linesWithQty) {
        // Atomically decrement — negative qty so $inc subtracts
        const updatedSQ = await StockQuantity.findOneAndUpdate(
          { product: line.product, location: line.sourceLocation },
          {
            $inc: {
              quantityOnHand:    -line.packedQty,
              quantityAvailable: -line.packedQty,
            },
            $set: { lastMovementAt: now },
          },
          { new: true, session }
        );

        // Immutable ledger entry (negative quantityChange = stock out)
        await StockLedger.create(
          [{
            product:        line.product,
            warehouse:      order.sourceWarehouse,
            location:       line.sourceLocation,
            movementType:   MOVEMENT_TYPES.DELIVERY,
            quantityChange: -line.packedQty,
            balanceAfter:   updatedSQ.quantityOnHand,
            reference: {
              docType:   'DeliveryOrder',
              docId:     order._id,
              docNumber: order.deliveryNumber,
            },
            performedBy: userId,
            timestamp:   now,
          }],
          { session }
        );

        stockChanges.push({
          product:     line.product,
          location:    line.sourceLocation,
          qtyRemoved:  line.packedQty,
          newBalance:  updatedSQ.quantityOnHand,
        });
      }

      // Stamp the delivery order as done
      await DeliveryOrder.updateOne(
        { _id: order._id },
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
  const updated = await DeliveryOrder.findById(deliveryOrderId)
    .populate('sourceWarehouse',      'name code')
    .populate('createdBy',            'name email')
    .populate('validatedBy',          'name email')
    .populate('lines.product',        'name sku unitOfMeasure')
    .populate('lines.sourceLocation', 'name type');

  // Notify operation completion and check stock levels after delivery
  notificationService.notifyOperationCompleted(
    'Delivery',
    updated._id,
    updated.deliveryNumber,
    updated.sourceWarehouse._id
  ).catch(err => console.error('Notification error:', err));

  // Check stock levels for all products in the delivery (may trigger low stock alerts)
  for (const line of linesWithQty) {
    notificationService.checkStockLevels(
      line.product,
      order.sourceWarehouse
    ).catch(err => console.error('Stock check error:', err));
  }

  return { order: updated, stockChanges };
}

// ─── 7. Cancel ────────────────────────────────────────────────────────────────

async function cancelDeliveryOrder(id) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid delivery order id', 'INVALID_ID');

  const order = await DeliveryOrder.findById(id);
  if (!order) throw notFound('Delivery order not found');

  if (order.status === DOC_STATUS.DONE) {
    throw conflict(
      'A validated delivery order cannot be canceled — use a Stock Adjustment to correct stock',
      'ORDER_DONE'
    );
  }
  if (order.status === DOC_STATUS.CANCELED) {
    throw conflict('Delivery order is already canceled', 'ALREADY_CANCELED');
  }

  order.status = DOC_STATUS.CANCELED;
  await order.save();
  return order;
}

// ─── 8. List ─────────────────────────────────────────────────────────────────

async function listDeliveryOrders({ status, sourceWarehouse, category, dateFrom, dateTo, page, limit }) {
  const { buildCategoryStages } = require('../utils/categoryPipeline');

  const baseMatch = {};
  if (status)          baseMatch.status          = status;
  if (sourceWarehouse) baseMatch.sourceWarehouse = new mongoose.Types.ObjectId(sourceWarehouse);
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
    { $lookup: { from: 'warehouses', localField: 'sourceWarehouse', foreignField: '_id', as: '_warehouse' } },
    { $addFields: { sourceWarehouse: { $arrayElemAt: ['$_warehouse', 0] } } },
    { $project: { _warehouse: 0 } },
    { $sort: { createdAt: -1 } },
    { $facet: {
      orders: [{ $skip: skip }, { $limit: limit }],
      meta:   [{ $count: 'total' }],
    }},
  ];

  const [result] = await DeliveryOrder.aggregate(pipeline);
  return { orders: result.orders, total: result.meta[0]?.total ?? 0, page, limit };
}

// ─── 9. Get single order (fully populated) ────────────────────────────────────

async function getDeliveryOrderById(id) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid delivery order id', 'INVALID_ID');

  const order = await DeliveryOrder.findById(id)
    .populate('sourceWarehouse',      'name code address')
    .populate('createdBy',            'name email')
    .populate('validatedBy',          'name email')
    .populate('lines.product',        'name sku unitOfMeasure')
    .populate('lines.sourceLocation', 'name type');

  if (!order) throw notFound('Delivery order not found');
  return order;
}

// ─── 10. Pending count (Dashboard KPI) ───────────────────────────────────────

async function getPendingCount() {
  return DeliveryOrder.countDocuments({
    status: { $in: [DOC_STATUS.DRAFT, DOC_STATUS.WAITING, DOC_STATUS.READY] },
  });
}

module.exports = {
  createDeliveryOrder,
  updateDeliveryOrder,
  addLine,
  removeLine,
  pickLine,
  packLine,
  validateDeliveryOrder,
  cancelDeliveryOrder,
  listDeliveryOrders,
  getDeliveryOrderById,
  getPendingCount,
};
