'use strict';

// Load env vars before anything else
require('dotenv').config();

const { connectDB } = require('./config/db');
const env           = require('./config/env');
const { createApp } = require('./app');
const { startNotificationJob } = require('./jobs/notification.job');

async function start() {
  // 1. Connect to MongoDB — will retry then exit if it never connects
  await connectDB();

  // 2. Build the Express app (all routes registered here)
  const app = createApp();

  // 3. Start HTTP server
  const server = app.listen(env.PORT, () => {
    console.log(`🚀  StockSense API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // 4. Start background notification job
  startNotificationJob();

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down gracefully…`);
    server.close(async () => {
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      console.log('   MongoDB connection closed.');
      process.exit(0);
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      console.error('   Forced shutdown after timeout.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // Unhandled promise rejections — log and exit so the process manager restarts
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    process.exit(1);
  });
}

start();
