'use strict';

const Counter = require('../models/Counter');

/**
 * Atomically increment a named counter and return a zero-padded document number.
 *
 * @param {string} prefix   e.g. 'RCV', 'DO', 'TRF', 'ADJ'
 * @param {number} [pad=5]  total digits to pad to (default gives "RCV-00001")
 * @param {object} [session] optional Mongoose session for transactional use
 * @returns {Promise<string>}  e.g. "RCV-00001"
 */
async function generateDocNumber(prefix, pad = 5, session = null) {
  const opts = { new: true, upsert: true };
  if (session) opts.session = session;

  const counter = await Counter.findOneAndUpdate(
    { _id: prefix },
    { $inc: { seq: 1 } },
    opts
  );

  return `${prefix}-${String(counter.seq).padStart(pad, '0')}`;
}

module.exports = { generateDocNumber };
