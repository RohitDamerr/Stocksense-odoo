'use strict';

const deliveryService            = require('../services/delivery.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { listDeliveryOrdersSchema } = require('../validators/delivery.validator');

// Static route — must be registered before /:id
async function pendingCount(req, res) {
  try {
    const count = await deliveryService.getPendingCount();
    return sendSuccess(res, 200, 'Pending delivery order count retrieved', { count });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function list(req, res) {
  try {
    const { error, value } = listDeliveryOrdersSchema.validate(req.query, {
      abortEarly: true, stripUnknown: true, convert: true,
    });
    if (error) {
      return sendError(res, 422, error.details[0].message.replace(/['"]/g, ''), 'VALIDATION_ERROR');
    }
    const result = await deliveryService.listDeliveryOrders(value);
    return sendSuccess(res, 200, 'Delivery orders retrieved', result);
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function getById(req, res) {
  try {
    const order = await deliveryService.getDeliveryOrderById(req.params.id);
    return sendSuccess(res, 200, 'Delivery order retrieved', { order });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function create(req, res) {
  try {
    const order = await deliveryService.createDeliveryOrder(req.body, req.user.userId);
    return sendSuccess(res, 201, 'Delivery order created', { order });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function update(req, res) {
  try {
    const order = await deliveryService.updateDeliveryOrder(req.params.id, req.body);
    return sendSuccess(res, 200, 'Delivery order updated', { order });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function addLine(req, res) {
  try {
    const order = await deliveryService.addLine(req.params.id, req.body);
    return sendSuccess(res, 200, 'Line added', { order });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function removeLine(req, res) {
  try {
    const order = await deliveryService.removeLine(req.params.id, req.params.lineId);
    return sendSuccess(res, 200, 'Line removed', { order });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function pickLine(req, res) {
  try {
    const order = await deliveryService.pickLine(
      req.params.id, req.params.lineId, req.body.pickedQty
    );
    return sendSuccess(res, 200, 'Pick quantity updated', { order });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function packLine(req, res) {
  try {
    const order = await deliveryService.packLine(
      req.params.id, req.params.lineId, req.body.packedQty
    );
    return sendSuccess(res, 200, 'Pack quantity updated', { order });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function validate(req, res) {
  try {
    const { order, stockChanges } = await deliveryService.validateDeliveryOrder(
      req.params.id, req.user.userId
    );
    return sendSuccess(res, 200, 'Delivery order validated — stock updated', { order, stockChanges });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function cancel(req, res) {
  try {
    const order = await deliveryService.cancelDeliveryOrder(req.params.id);
    return sendSuccess(res, 200, 'Delivery order canceled', { order });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

module.exports = {
  pendingCount, list, getById,
  create, update,
  addLine, removeLine,
  pickLine, packLine,
  validate, cancel,
};
