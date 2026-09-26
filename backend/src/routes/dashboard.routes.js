'use strict';

const express  = require('express');
const mongoose = require('mongoose');
const Joi      = require('joi');
const { verifyToken }  = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const Receipt          = require('../models/Receipt');
const DeliveryOrder    = require('../models/DeliveryOrder');
const InternalTransfer = require('../models/InternalTransfer');
const Product          = require('../models/Product');
const StockQuantity    = require('../models/StockQuantity');
const Warehouse        = require('../models/Warehouse');
const { DOC_STATUS }   = require('../constants/status');

const router = express.Router();
router.use(verifyToken);
router.use(requireRole('inventory_manager', 'admin', 'warehouse_staff'));

// ─── Query param schema ───────────────────────────────────────────────────────

const summaryQuerySchema = Joi.object({
  warehouse: Joi.string().pattern(/^[a-f\d]{24}$/i).optional()
    .messages({ 'string.pattern.base': 'warehouse must be a valid ObjectId' }),
});

// ─── Helper: build one KPI object for a given warehouseId (or null = global) ──

async function buildKpis(warehouseId) {
  const PENDING = [DOC_STATUS.DRAFT, DOC_STATUS.WAITING, DOC_STATUS.READY];
  const wId = warehouseId ? new mongoose.Types.ObjectId(warehouseId) : null;

  if (wId) {
    // ── Warehouse-scoped queries ──────────────────────────────────────────────

    const [
      pendingReceipts,
      pendingDeliveries,
      pendingTransfers,
      productsInStock,
      lowStockCount,
    ] = await Promise.all([

      // Receipts whose destination is this warehouse
      Receipt.countDocuments({
        status:               { $in: PENDING },
        destinationWarehouse: wId,
      }),

      // Deliveries whose source is this warehouse
      DeliveryOrder.countDocuments({
        status:          { $in: PENDING },
        sourceWarehouse: wId,
      }),

      // Transfers that involve this warehouse on ANY line (either end)
      InternalTransfer.countDocuments({
        status: { $in: PENDING },
        $or: [
          { lines: { $elemMatch: { sourceWarehouse:      wId } } },
          { lines: { $elemMatch: { destinationWarehouse: wId } } },
        ],
      }),

      // Distinct products with stock (quantityOnHand > 0) at this warehouse
      StockQuantity.distinct('product', {
        warehouse:      wId,
        quantityOnHand: { $gt: 0 },
      }).then((ids) => ids.length),

      // Low-stock: products where SUM(quantityAvailable) at this warehouse < reorderRule.minQty
      Product.aggregate([
        { $match: { reorderRule: { $ne: null }, isActive: true } },
        {
          $lookup: {
            from:     'stockquantities',
            let:      { pid: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$product',   '$$pid'] },
                      { $eq: ['$warehouse', wId]     },
                    ],
                  },
                },
              },
            ],
            as: 'sq',
          },
        },
        { $addFields: { totalAvailable: { $sum: '$sq.quantityAvailable' } } },
        { $match: { $expr: { $lt: ['$totalAvailable', '$reorderRule.minQty'] } } },
        { $count: 'total' },
      ]).then((r) => r[0]?.total ?? 0),
    ]);

    return { pendingReceipts, pendingDeliveries, pendingTransfers, productsInStock, lowStockCount };

  } else {
    // ── Global queries (original behavior, backward-compatible) ──────────────

    const [
      pendingReceipts,
      pendingDeliveries,
      pendingTransfers,
      totalProducts,
      lowStockCount,
    ] = await Promise.all([
      Receipt.countDocuments({ status: { $in: PENDING } }),
      DeliveryOrder.countDocuments({ status: { $in: PENDING } }),
      InternalTransfer.countDocuments({ status: { $in: PENDING } }),
      Product.countDocuments({ isActive: true }),
      Product.aggregate([
        { $match: { reorderRule: { $ne: null }, isActive: true } },
        { $lookup: { from: 'stockquantities', localField: '_id', foreignField: 'product', as: 'sq' } },
        { $addFields: { totalAvailable: { $sum: '$sq.quantityAvailable' } } },
        { $match: { $expr: { $lt: ['$totalAvailable', '$reorderRule.minQty'] } } },
        { $count: 'total' },
      ]).then((r) => r[0]?.total ?? 0),
    ]);

    return { pendingReceipts, pendingDeliveries, pendingTransfers, totalProducts, lowStockCount };
  }
}

// ─── GET /api/dashboard/summary ──────────────────────────────────────────────
// Optional: ?warehouse=<warehouseId>
// Without param: global KPIs (backward-compatible).
// With param:    KPIs scoped to that warehouse.

router.get('/summary', async (req, res) => {
  try {
    const { error, value } = summaryQuerySchema.validate(req.query, {
      abortEarly: true, stripUnknown: true,
    });
    if (error) {
      return sendError(res, 400, error.details[0].message.replace(/['"]/g, ''), 'VALIDATION_ERROR');
    }

    // If a warehouse id was given, verify it exists and is active
    if (value.warehouse) {
      const wh = await Warehouse.findById(value.warehouse);
      if (!wh)          return sendError(res, 404, 'Warehouse not found', 'NOT_FOUND');
      if (!wh.isActive) return sendError(res, 400, 'Warehouse is inactive', 'WAREHOUSE_INACTIVE');
    }

    const kpis = await buildKpis(value.warehouse || null);
    const scope = value.warehouse ? `warehouse:${value.warehouse}` : 'global';
    return sendSuccess(res, 200, 'Dashboard summary retrieved', { scope, ...kpis });
  } catch (err) {
    return sendError(res, 500, err.message, 'SERVER_ERROR');
  }
});

// ─── GET /api/dashboard/summary/by-warehouse ─────────────────────────────────
// Returns one KPI object per active warehouse in a single aggregation pass.
// No query params required.

router.get('/summary/by-warehouse', async (req, res) => {
  try {
    const PENDING = [DOC_STATUS.DRAFT, DOC_STATUS.WAITING, DOC_STATUS.READY];

    const warehouses = await Warehouse.find({ isActive: true }).lean();
    if (!warehouses.length) {
      return sendSuccess(res, 200, 'No active warehouses', { warehouses: [] });
    }

    const warehouseIds = warehouses.map((w) => w._id);

    // Run all aggregations in parallel — one query per KPI type, each
    // returns results grouped by warehouse so we do N_kpis queries not N_warehouses.

    const [
      receiptCounts,
      deliveryCounts,
      transferCounts,
      stockByWarehouse,
      lowStockByWarehouse,
    ] = await Promise.all([

      // Pending receipts grouped by destinationWarehouse
      Receipt.aggregate([
        { $match: { status: { $in: PENDING }, destinationWarehouse: { $in: warehouseIds } } },
        { $group: { _id: '$destinationWarehouse', count: { $sum: 1 } } },
      ]),

      // Pending deliveries grouped by sourceWarehouse
      DeliveryOrder.aggregate([
        { $match: { status: { $in: PENDING }, sourceWarehouse: { $in: warehouseIds } } },
        { $group: { _id: '$sourceWarehouse', count: { $sum: 1 } } },
      ]),

      // Pending transfers — unwind lines, collect distinct transferIds per warehouse, then count
      InternalTransfer.aggregate([
        { $match: { status: { $in: PENDING } } },
        { $unwind: '$lines' },
        {
          $group: {
            _id:          '$_id',
            warehouses:   { $addToSet: '$lines.sourceWarehouse' },
            warehousesDst:{ $addToSet: '$lines.destinationWarehouse' },
          },
        },
        {
          $project: {
            allWarehouses: { $setUnion: ['$warehouses', '$warehousesDst'] },
          },
        },
        { $unwind: '$allWarehouses' },
        {
          $group: {
            _id:   '$allWarehouses',
            count: { $sum: 1 },
          },
        },
      ]),

      // Products in stock (quantityOnHand > 0) grouped by warehouse
      StockQuantity.aggregate([
        { $match: { warehouse: { $in: warehouseIds }, quantityOnHand: { $gt: 0 } } },
        { $group: { _id: '$warehouse', productsInStock: { $addToSet: '$product' } } },
        { $project: { productsInStock: { $size: '$productsInStock' } } },
      ]),

      // Low-stock count per warehouse
      // Strategy: group StockQuantity by (warehouse, product) → sum available →
      // join product's reorderRule → filter where total < minQty
      StockQuantity.aggregate([
        { $match: { warehouse: { $in: warehouseIds } } },
        {
          $group: {
            _id:            { warehouse: '$warehouse', product: '$product' },
            totalAvailable: { $sum: '$quantityAvailable' },
          },
        },
        {
          $lookup: {
            from:         'products',
            localField:   '_id.product',
            foreignField: '_id',
            as:           'productDoc',
          },
        },
        { $unwind: '$productDoc' },
        {
          $match: {
            'productDoc.reorderRule': { $ne: null },
            'productDoc.isActive':    true,
            $expr: { $lt: ['$totalAvailable', '$productDoc.reorderRule.minQty'] },
          },
        },
        { $group: { _id: '$_id.warehouse', lowStockCount: { $sum: 1 } } },
      ]),
    ]);

    // Build lookup maps keyed by warehouse id string
    const receiptMap    = Object.fromEntries(receiptCounts.map((r)  => [r._id.toString(), r.count]));
    const deliveryMap   = Object.fromEntries(deliveryCounts.map((r) => [r._id.toString(), r.count]));
    const transferMap   = Object.fromEntries(transferCounts.map((r) => [r._id.toString(), r.count]));
    const stockMap      = Object.fromEntries(stockByWarehouse.map((r)   => [r._id.toString(), r.productsInStock]));
    const lowStockMap   = Object.fromEntries(lowStockByWarehouse.map((r) => [r._id.toString(), r.lowStockCount]));

    const result = warehouses.map((wh) => {
      const key = wh._id.toString();
      return {
        warehouse: { _id: wh._id, name: wh.name, code: wh.code },
        pendingReceipts:   receiptMap[key]  ?? 0,
        pendingDeliveries: deliveryMap[key] ?? 0,
        pendingTransfers:  transferMap[key] ?? 0,
        productsInStock:   stockMap[key]    ?? 0,
        lowStockCount:     lowStockMap[key] ?? 0,
      };
    });

    return sendSuccess(res, 200, 'Per-warehouse dashboard retrieved', { warehouses: result });
  } catch (err) {
    return sendError(res, 500, err.message, 'SERVER_ERROR');
  }
});

module.exports = router;
