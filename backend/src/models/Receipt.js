'use strict';

const mongoose = require('mongoose');
const { DOC_STATUS } = require('../constants/status');

const receiptLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    expectedQty: {
      type: Number,
      required: true,
      min: [0, 'expectedQty cannot be negative'],
    },
    receivedQty: {
      type: Number,
      default: 0,
      min: [0, 'receivedQty cannot be negative'],
    },
    destinationLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
  },
  { _id: true } // keep per-line _id so the UI can reference individual lines
);

const receiptSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      // Generated via Counter: "RCV-00042"
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    destinationWarehouse: {
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
      type: [receiptLineSchema],
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
receiptSchema.index({ status: 1, destinationWarehouse: 1 });

module.exports = mongoose.model('Receipt', receiptSchema);
