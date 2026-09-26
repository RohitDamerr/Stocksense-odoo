'use strict';

const receiptService             = require('../services/receipt.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { listReceiptsSchema }     = require('../validators/receipt.validator');

// ─── GET /api/receipts/pending-count ─────────────────────────────────────────
// Registered BEFORE /:id so "pending-count" is never treated as a param

async function pendingCount(req, res) {
  try {
    const count = await receiptService.getPendingCount();
    return sendSuccess(res, 200, 'Pending receipt count retrieved', { count });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── GET /api/receipts ────────────────────────────────────────────────────────

async function list(req, res) {
  try {
    const { error, value } = listReceiptsSchema.validate(req.query, {
      abortEarly: true, stripUnknown: true, convert: true,
    });
    if (error) {
      return sendError(res, 422, error.details[0].message.replace(/['"]/g, ''), 'VALIDATION_ERROR');
    }
    const result = await receiptService.listReceipts(value);
    return sendSuccess(res, 200, 'Receipts retrieved', result);
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── GET /api/receipts/:id ────────────────────────────────────────────────────

async function getById(req, res) {
  try {
    const receipt = await receiptService.getReceiptById(req.params.id);
    return sendSuccess(res, 200, 'Receipt retrieved', { receipt });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── POST /api/receipts ───────────────────────────────────────────────────────

async function create(req, res) {
  try {
    const receipt = await receiptService.createReceipt(req.body, req.user.userId);
    return sendSuccess(res, 201, 'Receipt created', { receipt });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── PATCH /api/receipts/:id ──────────────────────────────────────────────────

async function update(req, res) {
  try {
    const receipt = await receiptService.updateReceipt(req.params.id, req.body);
    return sendSuccess(res, 200, 'Receipt updated', { receipt });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── POST /api/receipts/:id/lines ─────────────────────────────────────────────

async function addLine(req, res) {
  try {
    const receipt = await receiptService.addLine(req.params.id, req.body);
    return sendSuccess(res, 200, 'Line added', { receipt });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── DELETE /api/receipts/:id/lines/:lineId ───────────────────────────────────

async function removeLine(req, res) {
  try {
    const receipt = await receiptService.removeLine(req.params.id, req.params.lineId);
    return sendSuccess(res, 200, 'Line removed', { receipt });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── PATCH /api/receipts/:id/lines/:lineId/receive ───────────────────────────

async function receiveQty(req, res) {
  try {
    const receipt = await receiptService.receiveQty(
      req.params.id,
      req.params.lineId,
      req.body.receivedQty
    );
    return sendSuccess(res, 200, 'Received quantity updated', { receipt });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── POST /api/receipts/:id/validate ─────────────────────────────────────────

async function validate(req, res) {
  try {
    const { receipt, stockChanges } = await receiptService.validateReceipt(
      req.params.id,
      req.user.userId
    );
    return sendSuccess(res, 200, 'Receipt validated — stock updated', { receipt, stockChanges });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── POST /api/receipts/:id/cancel ───────────────────────────────────────────

async function cancel(req, res) {
  try {
    const receipt = await receiptService.cancelReceipt(req.params.id);
    return sendSuccess(res, 200, 'Receipt canceled', { receipt });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

module.exports = {
  pendingCount, list, getById,
  create, update,
  addLine, removeLine, receiveQty,
  validate, cancel,
};
