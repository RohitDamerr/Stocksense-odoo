'use strict';

const productService             = require('../services/product.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { listProductsSchema }     = require('../validators/product.validator');

// ─── GET /api/products/reorder-alerts ────────────────────────────────────────
// Must be registered BEFORE /:id routes so Express doesn't treat "reorder-alerts" as an id

async function reorderAlerts(req, res) {
  try {
    const alerts = await productService.getReorderAlerts();
    return sendSuccess(res, 200, 'Reorder alerts retrieved', { alerts, total: alerts.length });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── GET /api/products ────────────────────────────────────────────────────────

async function list(req, res) {
  try {
    // Validate + coerce query params with Joi
    const { error, value } = listProductsSchema.validate(req.query, {
      abortEarly: true,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      return sendError(res, 422, error.details[0].message.replace(/['"]/g, ''), 'VALIDATION_ERROR');
    }

    const result = await productService.listProducts(value);
    return sendSuccess(res, 200, 'Products retrieved', result);
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── GET /api/products/:id ────────────────────────────────────────────────────

async function getById(req, res) {
  try {
    const { product, stockByLocation } = await productService.getProductById(req.params.id);
    return sendSuccess(res, 200, 'Product retrieved', { product, stockByLocation });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── POST /api/products ───────────────────────────────────────────────────────

async function create(req, res) {
  try {
    const product = await productService.createProduct(req.body, req.user.userId);
    return sendSuccess(res, 201, 'Product created', { product });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── PATCH /api/products/:id ──────────────────────────────────────────────────

async function update(req, res) {
  // SKU must never be updated — reject explicitly
  if ('sku' in req.body) {
    return sendError(res, 400, 'SKU cannot be changed after creation', 'SKU_IMMUTABLE');
  }

  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    return sendSuccess(res, 200, 'Product updated', { product });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

// ─── DELETE /api/products/:id (soft deactivate) ───────────────────────────────

async function deactivate(req, res) {
  try {
    const product = await productService.deactivateProduct(req.params.id);
    return sendSuccess(res, 200, 'Product deactivated', { product });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

module.exports = { list, getById, create, update, deactivate, reorderAlerts };
