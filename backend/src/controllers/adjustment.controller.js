'use strict';

const adjustmentService          = require('../services/adjustment.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { listAdjustmentsSchema }  = require('../validators/adjustment.validator');

// Static — before /:id
async function list(req, res) {
  try {
    const { error, value } = listAdjustmentsSchema.validate(req.query, {
      abortEarly: true, stripUnknown: true, convert: true,
    });
    if (error) {
      return sendError(res, 422, error.details[0].message.replace(/['"]/g, ''), 'VALIDATION_ERROR');
    }
    const result = await adjustmentService.listAdjustments(value);
    return sendSuccess(res, 200, 'Adjustments retrieved', result);
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function getById(req, res) {
  try {
    const adjustment = await adjustmentService.getAdjustmentById(req.params.id);
    return sendSuccess(res, 200, 'Adjustment retrieved', { adjustment });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function create(req, res) {
  try {
    const adjustment = await adjustmentService.createAdjustment(req.body, req.user.userId);
    return sendSuccess(res, 201, 'Adjustment created', { adjustment });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function addLine(req, res) {
  try {
    const adjustment = await adjustmentService.addLine(req.params.id, req.body);
    return sendSuccess(res, 200, 'Line added', { adjustment });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function removeLine(req, res) {
  try {
    const adjustment = await adjustmentService.removeLine(req.params.id, req.params.lineId);
    return sendSuccess(res, 200, 'Line removed', { adjustment });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function countLine(req, res) {
  try {
    const adjustment = await adjustmentService.countLine(
      req.params.id, req.params.lineId, req.body
    );
    return sendSuccess(res, 200, 'Counted quantity recorded', { adjustment });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function validate(req, res) {
  try {
    const { adjustment, summary, warnings } = await adjustmentService.validateAdjustment(
      req.params.id, req.user.userId
    );
    const message = warnings.length
      ? `Adjustment validated with ${warnings.length} reservation warning(s) — review open delivery orders`
      : 'Adjustment validated — stock corrected';
    return sendSuccess(res, 200, message, { adjustment, summary, warnings });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function cancel(req, res) {
  try {
    const adjustment = await adjustmentService.cancelAdjustment(req.params.id);
    return sendSuccess(res, 200, 'Adjustment canceled', { adjustment });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

module.exports = { list, getById, create, addLine, removeLine, countLine, validate, cancel };
