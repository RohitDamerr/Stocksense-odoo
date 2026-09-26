'use strict';

const mongoose = require('mongoose');
const { DOC_STATUS } = require('../constants/status');

const deliveryLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    orderedQty: {
      type: Number,
      required: true,
      min: [0, 'orderedQty cannot be negative'],
    },
    // Tracks partial progress through the Pick → Pack → Validate workflow
    pickedQty: {
      type: Number,
      default: 0,
      min: [0, 'pickedQty cannot be negative'],
    },
    packedQty: {
      type: Number,
      default: 0,
      min: [0, 'packedQty cannot be negative'],
    },
    sourceLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
  },
  { _id: true }
);

// Customer info embedded — customers are not a first-class entity in this system
const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: null },
    contact: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const deliveryOrderSchema = new mongoose.Schema(
  {
    deliveryNumber: {
      type: String,
      required: true,
      unique: true,
      // Generated via Counter: "DO-00007"
    },
    customer: {
      type: customerSchema,
      required: true,
    },
    sourceWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(DOC_STATUS),
      default: DOC_STATUS.DRAFT,
    },
    lines: {
      type: [deliveryLineSchema],
      default: [],
    },
    scheduledDate: {
      type: Date,
      default: null,
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
deliveryOrderSchema.index({ status: 1, sourceWarehouse: 1 });
// Unique document number
deliveryOrderSchema.index({ deliveryNumber: 1 }, { unique: true });
// Date-range listing
deliveryOrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DeliveryOrder', deliveryOrderSchema);
