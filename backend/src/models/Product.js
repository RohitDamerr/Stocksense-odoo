'use strict';

const mongoose = require('mongoose');

const reorderRuleSchema = new mongoose.Schema(
  {
    minQty: {
      type: Number,
      required: true,
      min: [0, 'minQty cannot be negative'],
    },
    maxQty: {
      type: Number,
      required: true,
      min: [0, 'maxQty cannot be negative'],
    },
    reorderQty: {
      type: Number,
      required: true,
      min: [0, 'reorderQty cannot be negative'],
    },
    preferredSupplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
      default: null,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    unitOfMeasure: {
      type: String,
      required: [true, 'Unit of measure is required'],
      trim: true,
      // e.g. "pcs" | "kg" | "l" | "box" — kept as free text for flexibility
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    reorderRule: {
      type: reorderRuleSchema,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// NOTE: No currentStock field — stock lives in StockQuantity (per product+location).
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });
// Case-insensitive unique index for SKU lookups
productSchema.index({ sku: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
// Text index for name/sku/barcode search (GET /api/products?search=...)
productSchema.index({ name: 'text', sku: 'text', barcode: 'text' });

module.exports = mongoose.model('Product', productSchema);
