'use strict';

/**
 * Warehouse routes — stub.
 * Full implementation will be added in the Warehouse Management module.
 */
const express = require('express');
const mongoose = require('mongoose');
const { verifyToken }  = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const Warehouse = require('../models/Warehouse');

const router = express.Router();
router.use(verifyToken);

const anyStaff = requireRole('inventory_manager', 'admin', 'warehouse_staff');
const managers = requireRole('inventory_manager', 'admin');

router.get('/', anyStaff, async (req, res) => {
  try {
    const warehouses = await Warehouse.find({ isActive: true }).sort({ name: 1 });
    return sendSuccess(res, 200, 'Warehouses retrieved', { warehouses });
  } catch (err) { return sendError(res, 500, err.message, 'SERVER_ERROR'); }
});

router.get('/:id', anyStaff, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return sendError(res, 400, 'Invalid id', 'INVALID_ID');
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return sendError(res, 404, 'Warehouse not found', 'NOT_FOUND');
    return sendSuccess(res, 200, 'Warehouse retrieved', { warehouse });
  } catch (err) { return sendError(res, 500, err.message, 'SERVER_ERROR'); }
});

router.post('/', managers, async (req, res) => {
  try {
    const { name, code, address } = req.body;
    const warehouse = await Warehouse.create({ name, code, address });
    return sendSuccess(res, 201, 'Warehouse created', { warehouse });
  } catch (err) {
    if (err.code === 11000) return sendError(res, 409, 'Warehouse code already exists', 'DUPLICATE_CODE');
    return sendError(res, 500, err.message, 'SERVER_ERROR');
  }
});

router.patch('/:id', managers, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return sendError(res, 400, 'Invalid id', 'INVALID_ID');
    const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!warehouse) return sendError(res, 404, 'Warehouse not found', 'NOT_FOUND');
    return sendSuccess(res, 200, 'Warehouse updated', { warehouse });
  } catch (err) { return sendError(res, 500, err.message, 'SERVER_ERROR'); }
});

module.exports = router;
