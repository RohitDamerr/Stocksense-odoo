'use strict';

const mongoose = require('mongoose');

const NOTIFICATION_TYPES = ['low_stock', 'out_of_stock'];

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
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
    // Snapshot of the quantity at the time the alert was generated
    currentQty: {
      type: Number,
      required: true,
    },
    // The reorderRule.minQty that was breached
    threshold: {
      type: Number,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    // createdAt only — notifications are never updated, just read or deleted
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

// Unread notifications feed (sorted by newest first)
notificationSchema.index({ isRead: 1, createdAt: -1 });

// Avoid duplicate alerts: one active alert per product+warehouse+type combo
notificationSchema.index({ product: 1, warehouse: 1, type: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
