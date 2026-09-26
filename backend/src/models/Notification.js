const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['LOW_STOCK', 'STOCKOUT', 'PENDING_RECEIPT', 'PENDING_DELIVERY', 'PENDING_TRANSFER', 'OPERATION_COMPLETED'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    productId: mongoose.Schema.Types.ObjectId,
    warehouseId: mongoose.Schema.Types.ObjectId,
    locationId: mongoose.Schema.Types.ObjectId,
    operationId: mongoose.Schema.Types.ObjectId,
    operationType: String,
    currentQuantity: Number,
    threshold: Number,
    reference: String
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries of unread notifications by user
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

// Index for cleanup of old read notifications
notificationSchema.index({ read: 1, createdAt: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
