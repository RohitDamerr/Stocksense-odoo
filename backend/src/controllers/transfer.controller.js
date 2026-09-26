'use strict';

const transferService            = require('../services/transfer.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { listTransfersSchema }    = require('../validators/transfer.validator');

// Static — before /:id
async function scheduledCount(req, res) {
  try {
    const count = await transferService.getScheduledCount();
    return sendSuccess(res, 200, 'Scheduled transfer count retrieved', { count });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function list(req, res) {
  try {
    const { error, value } = listTransfersSchema.validate(req.query, {
      abortEarly: true, stripUnknown: true, convert: true,
    });
    if (error) {
      return sendError(res, 422, error.details[0].message.replace(/['"]/g, ''), 'VALIDATION_ERROR');
    }
    const result = await transferService.listTransfers(value);
    return sendSuccess(res, 200, 'Transfers retrieved', result);
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function getById(req, res) {
  try {
    const transfer = await transferService.getTransferById(req.params.id);
    return sendSuccess(res, 200, 'Transfer retrieved', { transfer });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function create(req, res) {
  try {
    const transfer = await transferService.createTransfer(req.body, req.user.userId);
    return sendSuccess(res, 201, 'Transfer created', { transfer });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function update(req, res) {
  try {
    const transfer = await transferService.updateTransfer(req.params.id, req.body);
    return sendSuccess(res, 200, 'Transfer updated', { transfer });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function addLine(req, res) {
  try {
    const transfer = await transferService.addLine(req.params.id, req.body);
    return sendSuccess(res, 200, 'Line added', { transfer });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function removeLine(req, res) {
  try {
    const transfer = await transferService.removeLine(req.params.id, req.params.lineId);
    return sendSuccess(res, 200, 'Line removed', { transfer });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function confirmLine(req, res) {
  try {
    const transfer = await transferService.confirmLine(req.params.id, req.params.lineId);
    return sendSuccess(res, 200, 'Line confirmed', { transfer });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function validate(req, res) {
  try {
    const { transfer, stockChanges } = await transferService.validateTransfer(
      req.params.id, req.user.userId
    );
    return sendSuccess(
      res, 200,
      'Transfer validated — stock relocated (total company stock unchanged)',
      { transfer, stockChanges }
    );
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function cancel(req, res) {
  try {
    const transfer = await transferService.cancelTransfer(req.params.id);
    return sendSuccess(res, 200, 'Transfer canceled', { transfer });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

module.exports = {
  scheduledCount, list, getById,
  create, update,
  addLine, removeLine, confirmLine,
  validate, cancel,
};
