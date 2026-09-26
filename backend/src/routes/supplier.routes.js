'use strict';

/**
 * Supplier routes — stub.
 * Full implementation will be added in the Supplier Management module.
 */
const express  = require('express');
const mongoose = require('mongoose');
const { verifyToken }  = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const Supplier = require('../models/Supplier');

const router = express.Router();
router.use(verifyToken);

const anyStaff = requireRole('inventory_manager', 'admin', 'warehouse_staff');
const managers = requireRole('inventory_manager', 'admin');

router.get('/', anyStaff, async (req, res) => {
  try {
    const suppliers = await Supplier.find({ isActive: true }).sort({ name: 1 });
    return sendSuccess(res, 200, 'Suppliers retrieved', { suppliers });
  } catch (err) { return sendError(res, 500, err.message, 'SERVER_ERROR'); }
});

router.get('/:id', anyStaff, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return sendError(res, 400, 'Invalid id', 'INVALID_ID');
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return sendError(res, 404, 'Supplier not found', 'NOT_FOUND');
    return sendSuccess(res, 200, 'Supplier retrieved', { supplier });
  } catch (err) { return sendError(res, 500, err.message, 'SERVER_ERROR'); }
});

router.post('/', managers, async (req, res) => {
  try {
    const supplier = await Supplier.create(req.body);
    return sendSuccess(res, 201, 'Supplier created', { supplier });
  } catch (err) { return sendError(res, 500, err.message, 'SERVER_ERROR'); }
});

router.patch('/:id', managers, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return sendError(res, 400, 'Invalid id', 'INVALID_ID');
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!supplier) return sendError(res, 404, 'Supplier not found', 'NOT_FOUND');
    return sendSuccess(res, 200, 'Supplier updated', { supplier });
  } catch (err) { return sendError(res, 500, err.message, 'SERVER_ERROR'); }
});

module.exports = router;
