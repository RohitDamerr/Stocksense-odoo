'use strict';

const mongoose = require('mongoose');
const { DOC_STATUS } = require('../constants/status');

const transferLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Transfer quantity must be at least 1'],
    },
    sourceWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    sourceLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    destinationWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    destinationLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    // Set to true by the confirm step; all lines confirmed → status "ready"
    confirmed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const internalTransferSchema = new mongoose.Schema(
  {
    transferNumber: {
      type: String,
      required: true,
      unique: true,
      // Generated via Counter: "TRF-00015"
    },
    status: {
      type: String,
      enum: Object.values(DOC_STATUS),
      default: DOC_STATUS.DRAFT,
    },
    lines: {
      type: [transferLineSchema],
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

// Dashboard filter: open/pending transfers
internalTransferSchema.index({ status: 1 });
// Unique document number
internalTransferSchema.index({ transferNumber: 1 }, { unique: true });
// Date-range listing
internalTransferSchema.index({ createdAt: -1 });

module.exports = mongoose.model('InternalTransfer', internalTransferSchema);
