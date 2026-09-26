'use strict';

const mongoose          = require('mongoose');
const Receipt           = require('../models/Receipt');
const DeliveryOrder     = require('../models/DeliveryOrder');
const InternalTransfer  = require('../models/InternalTransfer');
const StockAdjustment   = require('../models/StockAdjustment');
const Warehouse         = require('../models/Warehouse');
const { buildCategoryStages } = require('../utils/categoryPipeline');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_TYPES = ['receipt', 'delivery', 'transfer', 'adjustment'];

/**
 * Build the aggregation pipeline for one document type, projected to the
 * normalized operations envelope shape.
 *
 * @param {object} params
 * @param {string}              params.docType
 * @param {object}              params.baseMatch     – pre-built $match for non-category filters
 * @param {Array}               params.categoryStages
 * @param {mongoose.Model}      params.Model
 * @param {string}              params.numberField   – e.g. 'receiptNumber'
 * @param {string|null}         params.warehouseField – top-level warehouse field name, or null for transfer
 * @param {object|null}         params.warehouseLookup – { from, localField } for inline $lookup
 */
function buildTypePipeline({
  docType,
  baseMatch,
  categoryStages,
  Model,
  numberField,
  warehouseField,
  warehouseLookup,
}) {
  // Build $addFields to produce warehouseSummary
  let warehouseSummaryExpr;
  if (docType === 'transfer') {
    // Transfers: summarise first line's src→dst warehouse names (already looked up above)
    // We don't join warehouse names inside the union sub-pipeline for transfers because
    // $lookup inside $unionWith is expensive; we instead denormalise to ids and the
    // controller resolves names in a post-pass if needed. For the list view we emit
    // a simple "Transfer" label — callers can enrich via GET /:id.
    warehouseSummaryExpr = 'Transfer';
  } else {
    warehouseSummaryExpr = `$${warehouseField}`;
  }

  const stages = [
    { $match: baseMatch },
    ...categoryStages,
  ];

  // Inline warehouse name lookup for single-warehouse types
  if (warehouseLookup) {
    stages.push({
      $lookup: {
        from:         warehouseLookup.from,
        localField:   warehouseLookup.localField,
        foreignField: '_id',
        as:           '_wh',
      },
    });
  }

  stages.push({
    $project: {
      documentType:     { $literal: docType },
      documentId:       '$_id',
      documentNumber:   `$${numberField}`,
      status:           1,
      // warehouseSummary: warehouse name for single-wh types; "Transfer" for transfers
      warehouseSummary: warehouseLookup
        ? { $ifNull: [{ $arrayElemAt: ['$_wh.name', 0] }, ''] }
        : { $literal: 'Transfer' },
      lineCount:        { $size: { $ifNull: ['$lines', []] } },
      createdAt:        1,
      scheduledDate:    { $ifNull: ['$scheduledDate', null] },
      validatedAt:      { $ifNull: ['$validatedAt', null] },
    },
  });

  return stages;
}

// ─── Main service function ────────────────────────────────────────────────────

/**
 * Return a paginated, normalized list across all four document types.
 * Uses $unionWith to merge collections server-side, then sorts and paginates.
 *
 * @param {object} filters
 * @param {string[]|null} filters.documentType  – subset of ALL_TYPES or null for all
 * @param {string|null}   filters.status
 * @param {string|null}   filters.warehouse
 * @param {string|null}   filters.category
 * @param {string|null}   filters.dateFrom
 * @param {string|null}   filters.dateTo
 * @param {string}        filters.sortBy        – 'createdAt' | 'scheduledDate'
 * @param {string}        filters.sortOrder     – 'asc' | 'desc'
 * @param {number}        filters.page
 * @param {number}        filters.limit
 * @returns {Promise<{ operations, total, page, limit }>}
 */
async function listAllOperations({
  documentType,
  status,
  warehouse,
  category,
  dateFrom,
  dateTo,
  sortBy    = 'createdAt',
  sortOrder = 'desc',
  page      = 1,
  limit     = 20,
}) {
  // Resolve which document types to query
  const types = documentType && documentType.length
    ? documentType.filter((t) => ALL_TYPES.includes(t))
    : ALL_TYPES;

  if (!types.length) return { operations: [], total: 0, page, limit };

  // ── Category stages (shared) ───────────────────────────────────────────────
  const categoryStages = await buildCategoryStages(category);
  if (categoryStages === null) {
    const e = new Error('Category not found'); e.code = 'NOT_FOUND'; e.status = 404; throw e;
  }

  // ── Per-type base $match builders ──────────────────────────────────────────

  const PENDING_STATUSES = ['draft', 'waiting', 'ready'];

  function dateRange() {
    if (!dateFrom && !dateTo) return null;
    const r = {};
    if (dateFrom) r.$gte = new Date(dateFrom);
    if (dateTo)   r.$lte = new Date(dateTo);
    return r;
  }

  function buildReceiptMatch() {
    const m = {};
    if (status)    m.status               = status;
    if (warehouse) m.destinationWarehouse = new mongoose.Types.ObjectId(warehouse);
    const dr = dateRange();
    if (dr)        m.createdAt            = dr;
    return m;
  }

  function buildDeliveryMatch() {
    const m = {};
    if (status)    m.status          = status;
    if (warehouse) m.sourceWarehouse = new mongoose.Types.ObjectId(warehouse);
    const dr = dateRange();
    if (dr)        m.createdAt       = dr;
    return m;
  }

  function buildTransferMatch() {
    const m = {};
    if (status) m.status = status;
    if (warehouse) {
      const wId = new mongoose.Types.ObjectId(warehouse);
      m.$or = [
        { 'lines.sourceWarehouse':      wId },
        { 'lines.destinationWarehouse': wId },
      ];
    }
    const dr = dateRange();
    if (dr) m.createdAt = dr;
    return m;
  }

  function buildAdjustmentMatch() {
    const m = {};
    if (status)    m.status    = status;
    if (warehouse) m.warehouse = new mongoose.Types.ObjectId(warehouse);
    const dr = dateRange();
    if (dr)        m.createdAt = dr;
    return m;
  }

  // ── Per-type pipeline segments ─────────────────────────────────────────────

  const pipelines = {
    receipt: buildTypePipeline({
      docType:        'receipt',
      baseMatch:      buildReceiptMatch(),
      categoryStages,
      Model:          Receipt,
      numberField:    'receiptNumber',
      warehouseLookup: { from: 'warehouses', localField: 'destinationWarehouse' },
    }),

    delivery: buildTypePipeline({
      docType:        'delivery',
      baseMatch:      buildDeliveryMatch(),
      categoryStages,
      Model:          DeliveryOrder,
      numberField:    'deliveryNumber',
      warehouseLookup: { from: 'warehouses', localField: 'sourceWarehouse' },
    }),

    transfer: buildTypePipeline({
      docType:        'transfer',
      baseMatch:      buildTransferMatch(),
      categoryStages,
      Model:          InternalTransfer,
      numberField:    'transferNumber',
      warehouseLookup: null,  // transfers summarised as "Transfer" (multi-location)
    }),

    adjustment: buildTypePipeline({
      docType:        'adjustment',
      baseMatch:      buildAdjustmentMatch(),
      categoryStages,
      Model:          StockAdjustment,
      numberField:    'adjustmentNumber',
      warehouseLookup: { from: 'warehouses', localField: 'warehouse' },
    }),
  };

  // ── Build the $unionWith chain ─────────────────────────────────────────────
  // Start from the first type, then $unionWith the rest.
  // We only include types that the caller asked for.

  const [firstType, ...restTypes] = types;

  const collectionMap = {
    receipt:    { model: Receipt,          coll: 'receipts'          },
    delivery:   { model: DeliveryOrder,    coll: 'deliveryorders'    },
    transfer:   { model: InternalTransfer, coll: 'internaltransfers' },
    adjustment: { model: StockAdjustment,  coll: 'stockadjustments'  },
  };

  // Get actual collection names from Mongoose (handles pluralization correctly)
  function collName(type) {
    return collectionMap[type].model.collection.name;
  }

  const unionWithStages = restTypes.map((type) => ({
    $unionWith: {
      coll:     collName(type),
      pipeline: pipelines[type],
    },
  }));

  const sortDir = sortOrder === 'asc' ? 1 : -1;
  const skip    = (page - 1) * limit;

  const masterPipeline = [
    // Start with the first type's pipeline
    ...pipelines[firstType],
    // Union the rest
    ...unionWithStages,
    // Sort the merged stream
    { $sort: { [sortBy]: sortDir, _id: 1 } },  // _id as tiebreaker for stable pagination
    // Single $facet for count + page in one round-trip
    {
      $facet: {
        operations: [{ $skip: skip }, { $limit: limit }],
        meta:       [{ $count: 'total' }],
      },
    },
  ];

  // Run the pipeline on the first collection's model
  const [result] = await collectionMap[firstType].model.aggregate(masterPipeline);

  return {
    operations: result.operations ?? [],
    total:      result.meta[0]?.total ?? 0,
    page,
    limit,
  };
}

module.exports = { listAllOperations };
