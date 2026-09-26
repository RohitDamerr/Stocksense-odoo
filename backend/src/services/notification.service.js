const Notification = require('../models/Notification');
const Product = require('../models/Product');
const StockLedger = require('../models/StockLedger');
const Receipt = require('../models/Receipt');
const DeliveryOrder = require('../models/DeliveryOrder');
const InternalTransfer = require('../models/InternalTransfer');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');

/**
 * Create a notification for specific users or roles
 */
const createNotification = async ({ userIds, roles, type, priority, title, message, data }) => {
  try {
    let targetUserIds = userIds || [];

    // If roles specified, find all users with those roles
    if (roles && roles.length > 0) {
      const users = await User.find({ role: { $in: roles } }).select('_id');
      const roleUserIds = users.map(u => u._id);
      targetUserIds = [...new Set([...targetUserIds, ...roleUserIds])];
    }

    // Create notification for each user
    const notifications = targetUserIds.map(userId => ({
      userId,
      type,
      priority: priority || 'medium',
      title,
      message,
      data: data || {}
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    return notifications.length;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Get notifications for a user
 */
const getNotifications = async (userId, { read, limit = 50, skip = 0 } = {}) => {
  const query = { userId };
  
  if (read !== undefined) {
    query.read = read;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({ userId, read: false });

  return {
    notifications,
    total,
    unreadCount,
    limit,
    skip
  };
};

/**
 * Mark notification as read
 */
const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    throw new Error('Notification not found');
  }

  return notification;
};

/**
 * Mark all notifications as read for a user
 */
const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { userId, read: false },
    { read: true, readAt: new Date() }
  );

  return result.modifiedCount;
};

/**
 * Delete a notification
 */
const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    userId
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  return notification;
};

/**
 * Check stock levels and create low stock/stockout notifications
 */
const checkStockLevels = async (productId, warehouseId) => {
  try {
    const product = await Product.findById(productId);
    if (!product) return;

    // Calculate current stock level for the warehouse
    const stockLedger = await StockLedger.aggregate([
      {
        $match: {
          productId: product._id,
          warehouseId: warehouseId
        }
      },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

    const currentQuantity = stockLedger.length > 0 ? stockLedger[0].totalQuantity : 0;

    // Check for stockout (quantity <= 0)
    if (currentQuantity <= 0) {
      await createNotification({
        roles: [ROLES.ADMIN, ROLES.MANAGER],
        type: 'STOCKOUT',
        priority: 'critical',
        title: 'Stockout Alert',
        message: `Product "${product.name}" (${product.sku}) is out of stock`,
        data: {
          productId: product._id,
          warehouseId,
          currentQuantity: 0,
          threshold: product.reorderLevel
        }
      });
    }
    // Check for low stock (quantity > 0 but <= reorderLevel)
    else if (product.reorderLevel && currentQuantity <= product.reorderLevel) {
      await createNotification({
        roles: [ROLES.ADMIN, ROLES.MANAGER],
        type: 'LOW_STOCK',
        priority: 'high',
        title: 'Low Stock Alert',
        message: `Product "${product.name}" (${product.sku}) is running low. Current: ${currentQuantity}, Reorder at: ${product.reorderLevel}`,
        data: {
          productId: product._id,
          warehouseId,
          currentQuantity,
          threshold: product.reorderLevel
        }
      });
    }
  } catch (error) {
    console.error('Error checking stock levels:', error);
  }
};

/**
 * Check for pending operations and create notifications
 */
const checkPendingOperations = async (warehouseId) => {
  try {
    // Check pending receipts
    const pendingReceipts = await Receipt.countDocuments({
      warehouseId,
      state: { $in: ['draft', 'waiting', 'ready'] }
    });

    if (pendingReceipts > 5) {
      await createNotification({
        roles: [ROLES.ADMIN, ROLES.MANAGER],
        type: 'PENDING_RECEIPT',
        priority: 'medium',
        title: 'Pending Receipts',
        message: `You have ${pendingReceipts} pending receipt(s) that need attention`,
        data: {
          warehouseId,
          count: pendingReceipts
        }
      });
    }

    // Check pending deliveries
    const pendingDeliveries = await DeliveryOrder.countDocuments({
      warehouseId,
      state: { $in: ['draft', 'waiting', 'assigned'] }
    });

    if (pendingDeliveries > 5) {
      await createNotification({
        roles: [ROLES.ADMIN, ROLES.MANAGER],
        type: 'PENDING_DELIVERY',
        priority: 'medium',
        title: 'Pending Deliveries',
        message: `You have ${pendingDeliveries} pending delivery order(s) that need attention`,
        data: {
          warehouseId,
          count: pendingDeliveries
        }
      });
    }

    // Check pending transfers
    const pendingTransfers = await InternalTransfer.countDocuments({
      $or: [
        { sourceWarehouseId: warehouseId },
        { destinationWarehouseId: warehouseId }
      ],
      state: { $in: ['draft', 'waiting'] }
    });

    if (pendingTransfers > 5) {
      await createNotification({
        roles: [ROLES.ADMIN, ROLES.MANAGER],
        type: 'PENDING_TRANSFER',
        priority: 'medium',
        title: 'Pending Transfers',
        message: `You have ${pendingTransfers} pending transfer(s) that need attention`,
        data: {
          warehouseId,
          count: pendingTransfers
        }
      });
    }
  } catch (error) {
    console.error('Error checking pending operations:', error);
  }
};

/**
 * Notify operation completion
 */
const notifyOperationCompleted = async (operationType, operationId, reference, warehouseId) => {
  try {
    await createNotification({
      roles: [ROLES.ADMIN, ROLES.MANAGER],
      type: 'OPERATION_COMPLETED',
      priority: 'low',
      title: 'Operation Completed',
      message: `${operationType} ${reference} has been completed successfully`,
      data: {
        operationType,
        operationId,
        reference,
        warehouseId
      }
    });
  } catch (error) {
    console.error('Error notifying operation completion:', error);
  }
};

/**
 * Clean up old read notifications (older than 30 days)
 */
const cleanupOldNotifications = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await Notification.deleteMany({
    read: true,
    readAt: { $lt: thirtyDaysAgo }
  });

  return result.deletedCount;
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  checkStockLevels,
  checkPendingOperations,
  notifyOperationCompleted,
  cleanupOldNotifications
};
