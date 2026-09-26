'use strict';

const MOVEMENT_TYPES = Object.freeze({
  RECEIPT: 'receipt',
  DELIVERY: 'delivery',
  TRANSFER_IN: 'transfer_in',
  TRANSFER_OUT: 'transfer_out',
  ADJUSTMENT: 'adjustment',
});

module.exports = MOVEMENT_TYPES;
