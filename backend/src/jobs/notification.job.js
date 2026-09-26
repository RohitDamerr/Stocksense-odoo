const cron = require('node-cron');
const notificationService = require('../services/notification.service');
const Warehouse = require('../models/Warehouse');
const Product = require('../models/Product');

let isJobRunning = false;

/**
 * Run periodic notification checks
 */
async function runNotificationChecks() {
  if (isJobRunning) {
    console.log('Notification job already running, skipping...');
    return;
  }

  isJobRunning = true;
  const startTime = Date.now();

  try {
    console.log('Starting notification checks...');

    // Get all active warehouses
    const warehouses = await Warehouse.find({ isActive: true }).select('_id name');

    // Check pending operations for each warehouse
    for (const warehouse of warehouses) {
      await notificationService.checkPendingOperations(warehouse._id);
    }

    // Get all products with reorder levels and check stock
    const products = await Product.find({ 
      isActive: true, 
      reorderLevel: { $exists: true, $ne: null, $gt: 0 } 
    }).select('_id name sku reorderLevel');

    let stockChecks = 0;
    for (const product of products) {
      for (const warehouse of warehouses) {
        await notificationService.checkStockLevels(product._id, warehouse._id);
        stockChecks++;
      }
    }

    // Clean up old notifications (older than 30 days)
    const cleanedCount = await notificationService.cleanupOldNotifications();

    const duration = Date.now() - startTime;
    console.log(`Notification checks completed in ${duration}ms:`, {
      warehouses: warehouses.length,
      products: products.length,
      stockChecks,
      cleanedNotifications: cleanedCount
    });

  } catch (error) {
    console.error('Error in notification job:', error);
  } finally {
    isJobRunning = false;
  }
}

/**
 * Start the notification job scheduler
 */
function startNotificationJob() {
  // Run every 30 minutes
  const task = cron.schedule('*/30 * * * *', runNotificationChecks, {
    scheduled: false,
    timezone: 'UTC'
  });

  task.start();
  console.log('Notification job scheduled to run every 30 minutes');

  // Also run once immediately after startup (with 1 minute delay)
  setTimeout(runNotificationChecks, 60000);

  return task;
}

/**
 * Manual trigger for testing
 */
function triggerNotificationCheck() {
  return runNotificationChecks();
}

module.exports = {
  startNotificationJob,
  triggerNotificationCheck,
  runNotificationChecks
};