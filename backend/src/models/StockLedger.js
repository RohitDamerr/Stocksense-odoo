'use strict';

const mongoose = require('mongoose');
const MOVEMENT_TYPES = require('../constants/movementTypes');

const DOC_TYPES = ['Receipt', 'DeliveryOrder', 'InternalTransfer', 'StockAdjustment'];

/**
 * Immutable audit trail of every stock movement.
 *
 * Rules:
 *  - NEVER updated or deleted after insert.
 *  - Always inserted inside the same transaction that mutates StockQuantity.
 *  - quantityChange is signed: positive = stock in, negative = stock out.
 *  - balanceAfter is the running balance at this (product, location) after this entry.
 */
const stockLedgerSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    movementType: {
      type: String,
      enum: Object.values(MOVEMENT_TYPES),
      required: true,
    },
    // Signed quantity: positive = in, negative = out
    quantityChange: {
      type: Number,
      required: true,
    },
    // Running balance at this location after this entry (for audit / reconciliation)
    balanceAfter: {
      type: Number,
      required: true,
    },
    reference: {
      docType: {
        type: String,
        enum: DOC_TYPES,
        required: true,
      },
      docId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      docNumber: {
        type: String,
        required: true,
      },
      _id: false,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  {
    timestamps: false, // timestamp field above is the canonical one
    versionKey: false,
  }
);

// Move-history screen: all movements for a product at a location, newest first
stockLedgerSchema.index({ product: 1, location: 1, timestamp: -1 });

// Jump from any document (receipt / delivery / etc.) to its ledger entries
stockLedgerSchema.index({ 'reference.docId': 1 });

module.exports = mongoose.model('StockLedger', stockLedgerSchema);
