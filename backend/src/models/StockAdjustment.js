'use strict';

const mongoose = require('mongoose');
const { ADJUSTMENT_STATUS } = require('../constants/status');

const adjustmentLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    // What StockQuantity showed before the physical count
    systemQty: {
      type: Number,
      required: true,
      min: [0, 'systemQty cannot be negative'],
    },
    // What was actually counted
    countedQty: {
      type: Number,
      required: true,
      min: [0, 'countedQty cannot be negative'],
    },
    // countedQty - systemQty (stored so ledger entries don't need to recompute it)
    difference: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      default: null,
      // e.g. "damaged" | "miscount" | "theft" | "found"
    },
  },
  { _id: true }
);

const stockAdjustmentSchema = new mongoose.Schema(
  {
    adjustmentNumber: {
      type: String,
      required: true,
      unique: true,
      // Generated via Counter: "ADJ-00003"
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ADJUSTMENT_STATUS),
      default: ADJUSTMENT_STATUS.DRAFT,
    },
    lines: {
      type: [adjustmentLineSchema],
      default: [],
    },
    validatedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

stockAdjustmentSchema.index({ status: 1, warehouse: 1 });

module.exports = mongoose.model('StockAdjustment', stockAdjustmentSchema);
