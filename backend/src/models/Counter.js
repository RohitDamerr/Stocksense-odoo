'use strict';

const mongoose = require('mongoose');

/**
 * Atomic sequence counter used to generate human-readable document numbers
 * such as RCV-00042, DO-00007, TRF-00015, ADJ-00003.
 *
 * Usage:
 *   const { seq } = await Counter.findOneAndUpdate(
 *     { _id: 'RCV' },
 *     { $inc: { seq: 1 } },
 *     { new: true, upsert: true }
 *   );
 *   const receiptNumber = `RCV-${String(seq).padStart(5, '0')}`;
 */
const counterSchema = new mongoose.Schema(
  {
    _id: {
      type: String, // prefix: 'RCV' | 'DO' | 'TRF' | 'ADJ'
      required: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    // No timestamps needed — this is a utility collection
    versionKey: false,
  }
);

module.exports = mongoose.model('Counter', counterSchema);
