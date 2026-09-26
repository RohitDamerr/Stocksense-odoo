'use strict';

const mongoose = require('mongoose');

/**
 * Cache of current stock levels per (product, location).
 *
 * This collection is DERIVED — it is always written alongside a StockLedger
 * insert inside a MongoDB transaction. Never mutate it outside of that pattern.
 *
 * quantityAvailable = quantityOnHand - quantityReserved
 * This is kept in sync on every write so dashboard reads never need to compute it.
 */
const stockQuantitySchema = new mongoose.Schema(
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
    // Denormalized for fast warehouse-level rollups without a join through location
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    quantityOnHand: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'quantityOnHand cannot be negative'],
    },
    // Stock committed to open (non-validated) delivery orders
    quantityReserved: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'quantityReserved cannot be negative'],
    },
    // onHand - reserved; kept in sync on write
    quantityAvailable: {
      type: Number,
      required: true,
      default: 0,
    },
    lastMovementAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false, // lastMovementAt is the relevant timestamp here
    versionKey: false,
  }
);

// Primary lookup: "what is the current stock of product X at location Y?"
stockQuantitySchema.index({ product: 1, location: 1 }, { unique: true });

// Powers the "Low Stock / Out of Stock" KPI and warehouse-level rollups
stockQuantitySchema.index({ warehouse: 1, quantityAvailable: 1 });

module.exports = mongoose.model('StockQuantity', stockQuantitySchema);
