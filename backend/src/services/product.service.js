'use strict';

const mongoose     = require('mongoose');
const Product      = require('../models/Product');
const Category     = require('../models/Category');
const Location     = require('../models/Location');
const Warehouse    = require('../models/Warehouse');
const StockQuantity = require('../models/StockQuantity');
const StockLedger  = require('../models/StockLedger');
const MOVEMENT_TYPES = require('../constants/movementTypes');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function throwNotFound(msg = 'Product not found') {
  const err = new Error(msg);
  err.code   = 'NOT_FOUND';
  err.status = 404;
  throw err;
}

function throwConflict(msg, code = 'CONFLICT') {
  const err = new Error(msg);
  err.code   = code;
  err.status = 409;
  throw err;
}

function throwBadRequest(msg, code = 'BAD_REQUEST') {
  const err = new Error(msg);
  err.code   = code;
  err.status = 400;
  throw err;
}

// ─── 1. Create product (with optional initial stock, in a transaction) ────────

/**
 * @param {object} dto
 * @param {string} performedBy  — req.user.userId
 */
async function createProduct(dto, performedBy) {
  const {
    name, sku, barcode, category, unitOfMeasure,
    description, reorderRule, initialStock,
  } = dto;

  // --- pre-flight checks (outside transaction — cheaper reads first) ---

  // Category must exist
  const categoryDoc = await Category.findById(category);
  if (!categoryDoc) {
    const err = new Error('Category not found');
    err.code   = 'CATEGORY_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // SKU uniqueness (case-insensitive)
  const skuExists = await Product.findOne({ sku: sku.toUpperCase() });
  if (skuExists) {
    throwConflict(`SKU "${sku.toUpperCase()}" is already in use`, 'SKU_EXISTS');
  }

  // If initialStock provided, validate warehouse + location exist and match
  let locationDoc, warehouseDoc;
  if (initialStock) {
    warehouseDoc = await Warehouse.findById(initialStock.warehouse);
    if (!warehouseDoc) throwNotFound('Warehouse not found');

    locationDoc = await Location.findById(initialStock.location);
    if (!locationDoc) throwNotFound('Location not found');

    // Location must belong to the given warehouse
    if (locationDoc.warehouse.toString() !== initialStock.warehouse.toString()) {
      throwBadRequest('Location does not belong to the specified warehouse', 'LOCATION_WAREHOUSE_MISMATCH');
    }
  }

  // --- transactional writes ---

  const session = await mongoose.startSession();
  let product;

  try {
    await session.withTransaction(async () => {
      // 1. Create product
      [product] = await Product.create(
        [{
          name,
          sku:           sku.toUpperCase(),
          barcode:       barcode || null,
          category,
          unitOfMeasure,
          description:   description || null,
          reorderRule:   reorderRule || null,
          isActive:      true,
        }],
        { session }
      );

      if (initialStock) {
        const { quantity } = initialStock;

        // 2. Upsert StockQuantity
        await StockQuantity.findOneAndUpdate(
          { product: product._id, location: locationDoc._id },
          {
            $set: {
              warehouse:         warehouseDoc._id,
              quantityOnHand:    quantity,
              quantityReserved:  0,
              quantityAvailable: quantity,
              lastMovementAt:    new Date(),
            },
          },
          { upsert: true, session, new: true }
        );

        // 3. Insert StockLedger entry
        await StockLedger.create(
          [{
            product:       product._id,
            warehouse:     warehouseDoc._id,
            location:      locationDoc._id,
            movementType:  MOVEMENT_TYPES.ADJUSTMENT,
            quantityChange: quantity,
            balanceAfter:  quantity,
            reference: {
              docType:   'Product',
              docId:     product._id,
              docNumber: `INIT-${product.sku}`,
            },
            performedBy,
            timestamp: new Date(),
          }],
          { session }
        );
      }
    });
  } finally {
    session.endSession();
  }

  return product;
}

// ─── 2. Update product ────────────────────────────────────────────────────────

async function updateProduct(id, updates) {
  if (!mongoose.isValidObjectId(id)) throwBadRequest('Invalid product id', 'INVALID_ID');

  const product = await Product.findById(id);
  if (!product) throwNotFound();

  // Validate category if being changed
  if (updates.category) {
    const cat = await Category.findById(updates.category);
    if (!cat) {
      const err = new Error('Category not found');
      err.code   = 'CATEGORY_NOT_FOUND';
      err.status = 404;
      throw err;
    }
  }

  Object.assign(product, updates);
  await product.save();
  return product;
}

// ─── 3. List products with aggregated stock totals ────────────────────────────

/**
 * Supports: search, category, isActive, page, limit, sortBy, sortOrder.
 * Returns: { products, total, page, limit }
 */
async function listProducts({ search, category, isActive, page, limit, sortBy, sortOrder }) {
  const matchStage = {};

  if (search) {
    // Use text index if available; fall back to regex for partial matches
    matchStage.$or = [
      { $text: { $search: search } },
      { name:    { $regex: search, $options: 'i' } },
      { sku:     { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
    ];
  }
  if (category)            matchStage.category = new mongoose.Types.ObjectId(category);
  if (isActive !== undefined) matchStage.isActive = isActive;

  const sortDir   = sortOrder === 'asc' ? 1 : -1;
  const sortField = sortBy || 'createdAt';
  const skip      = (page - 1) * limit;

  const pipeline = [
    { $match: matchStage },

    // Join aggregated stock totals from StockQuantity
    {
      $lookup: {
        from:         'stockquantities',
        localField:   '_id',
        foreignField: 'product',
        as:           'stockRows',
      },
    },

    // Compute totalAvailable + totalOnHand for each product
    {
      $addFields: {
        totalAvailable: { $sum: '$stockRows.quantityAvailable' },
        totalOnHand:    { $sum: '$stockRows.quantityOnHand' },
      },
    },

    // Drop the raw stockRows array to keep response lean
    { $project: { stockRows: 0 } },

    // Populate category name
    {
      $lookup: {
        from:         'categories',
        localField:   'category',
        foreignField: '_id',
        as:           'category',
      },
    },
    {
      $unwind: {
        path: '$category',
        preserveNullAndEmptyArrays: true,
      },
    },

    { $sort: { [sortField]: sortDir } },

    // Parallel facet: paginated results + total count in one round-trip
    {
      $facet: {
        products: [{ $skip: skip }, { $limit: limit }],
        meta:     [{ $count: 'total' }],
      },
    },
  ];

  const [result] = await Product.aggregate(pipeline);
  const products = result.products;
  const total    = result.meta[0]?.total ?? 0;

  return { products, total, page, limit };
}

// ─── 4. Single product detail with per-location stock breakdown ───────────────

async function getProductById(id) {
  if (!mongoose.isValidObjectId(id)) throwBadRequest('Invalid product id', 'INVALID_ID');

  const product = await Product.findById(id)
    .populate('category', 'name parentCategory')
    .populate('reorderRule.preferredSupplier', 'name email phone');

  if (!product) throwNotFound();

  // Per-location stock breakdown
  const stockByLocation = await StockQuantity.find({ product: id })
    .populate('location',  'name type')
    .populate('warehouse', 'name code')
    .select('location warehouse quantityOnHand quantityReserved quantityAvailable lastMovementAt')
    .lean();

  return { product, stockByLocation };
}

// ─── 5. Reorder alerts ────────────────────────────────────────────────────────

/**
 * Return products where total quantityAvailable < reorderRule.minQty.
 */
async function getReorderAlerts() {
  const pipeline = [
    // Only products that have a reorder rule defined
    { $match: { reorderRule: { $ne: null }, isActive: true } },

    // Join stock totals
    {
      $lookup: {
        from:         'stockquantities',
        localField:   '_id',
        foreignField: 'product',
        as:           'stockRows',
      },
    },
    {
      $addFields: {
        totalAvailable: { $sum: '$stockRows.quantityAvailable' },
      },
    },

    // Keep only products below their minQty threshold
    {
      $match: {
        $expr: { $lt: ['$totalAvailable', '$reorderRule.minQty'] },
      },
    },

    // Populate preferredSupplier
    {
      $lookup: {
        from:         'suppliers',
        localField:   'reorderRule.preferredSupplier',
        foreignField: '_id',
        as:           'supplierInfo',
      },
    },
    {
      $addFields: {
        'reorderRule.preferredSupplier': {
          $arrayElemAt: ['$supplierInfo', 0],
        },
      },
    },

    {
      $project: {
        name:                              1,
        sku:                               1,
        totalAvailable:                    1,
        'reorderRule.minQty':              1,
        'reorderRule.reorderQty':          1,
        'reorderRule.preferredSupplier':   1,
        stockRows:                         0,
        supplierInfo:                      0,
      },
    },

    { $sort: { totalAvailable: 1 } }, // most urgent first
  ];

  return Product.aggregate(pipeline);
}

// ─── 6. Deactivate (soft delete) ─────────────────────────────────────────────

async function deactivateProduct(id) {
  if (!mongoose.isValidObjectId(id)) throwBadRequest('Invalid product id', 'INVALID_ID');

  const product = await Product.findById(id);
  if (!product) throwNotFound();

  if (!product.isActive) {
    throwBadRequest('Product is already inactive', 'ALREADY_INACTIVE');
  }

  // Block deactivation if any stock still exists anywhere
  const stockCheck = await StockQuantity.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(id) } },
    { $group: { _id: null, totalOnHand: { $sum: '$quantityOnHand' } } },
  ]);

  const totalOnHand = stockCheck[0]?.totalOnHand ?? 0;
  if (totalOnHand > 0) {
    throwConflict(
      `Cannot deactivate: product still has ${totalOnHand} unit(s) on hand across all locations. ` +
      'Zero out the stock via a Stock Adjustment first.',
      'STOCK_NOT_ZERO'
    );
  }

  product.isActive = false;
  await product.save();
  return product;
}

module.exports = {
  createProduct,
  updateProduct,
  listProducts,
  getProductById,
  getReorderAlerts,
  deactivateProduct,
};
