'use strict';

const mongoose = require('mongoose');
const { ADJUSTMENT_STATUS } = require('../constants/status');

const VALID_REASONS = ['damaged', 'miscount', 'theft', 'expired', 'found', 'other'];

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
    // Snapshot of StockQuantity.quantityOnHand at the moment the line was added.
    // Refreshed again right before the user enters countedQty (see count step).
    systemQty: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'systemQty cannot be negative'],
    },
    // Null until the user enters a physical count (PATCH .../count).
    // 0 is a valid value — "shelf is empty".
    countedQty: {
      type: Number,
      default: null,
      min: [0, 'countedQty cannot be negative'],
    },
    // countedQty - systemQty. Computed server-side; never trusted from client.
    // Null until countedQty is entered.
    difference: {
      type: Number,
      default: null,
    },
    reason: {
      type: String,
      enum: [...VALID_REASONS, null],
      trim: true,
      default: null,
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
      // Generated via Counter with prefix "ADJ": "ADJ-00001"
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

// Dashboard filter: status + warehouse
stockAdjustmentSchema.index({ status: 1, warehouse: 1 });
// Document-number lookups
stockAdjustmentSchema.index({ adjustmentNumber: 1 }, { unique: true });
// Reason-based reporting (optional analytics)
stockAdjustmentSchema.index({ 'lines.reason': 1 });
// Date-range listing
stockAdjustmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StockAdjustment', stockAdjustmentSchema);
module.exports.VALID_REASONS = VALID_REASONS;
