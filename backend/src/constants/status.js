'use strict';

/** Shared statuses for operational documents (receipts, deliveries, transfers) */
const DOC_STATUS = Object.freeze({
  DRAFT: 'draft',
  WAITING: 'waiting',
  READY: 'ready',
  DONE: 'done',
  CANCELED: 'canceled',
});

/** Statuses for stock adjustments (no waiting/ready phase) */
const ADJUSTMENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  DONE: 'done',
  CANCELED: 'canceled',
});

module.exports = { DOC_STATUS, ADJUSTMENT_STATUS };
