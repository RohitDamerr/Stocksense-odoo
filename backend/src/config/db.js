'use strict';

const mongoose = require('mongoose');
const env      = require('./env');

const RETRY_DELAY_MS = 5000;
const MAX_RETRIES    = 5;

/**
 * Connect to MongoDB with exponential-backoff retry.
 * Mongoose handles reconnections automatically after the initial connect;
 * this function only retries the cold-start connection.
 */
async function connectDB(attempt = 1) {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      // No need for deprecated options in Mongoose 7+
    });
    console.log(`✅  MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error(`❌  MongoDB connection failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message}`);

    if (attempt >= MAX_RETRIES) {
      console.error('    Max retries reached. Exiting process.');
      process.exit(1);
    }

    const delay = RETRY_DELAY_MS * attempt; // linear back-off: 5s, 10s, 15s …
    console.log(`    Retrying in ${delay / 1000}s…`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return connectDB(attempt + 1);
  }
}

// Surface Mongoose connection events to stdout so ops teams see them in logs
mongoose.connection.on('disconnected', () => console.warn('⚠️   MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => console.log('✅  MongoDB reconnected'));
mongoose.connection.on('error',        (err) => console.error('❌  MongoDB error:', err.message));

module.exports = { connectDB };
