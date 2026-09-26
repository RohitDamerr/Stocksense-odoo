'use strict';

/**
 * Location routes.
 * Supports: GET /locations?warehouse=<id>&type=<type>
 */
const express  = require('express');
const mongoose = require('mongoose');
const Joi      = require('joi');
const { verifyToken }  = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const Location  = require('../models/Location');

const LOCATION_TYPES = ['storage', 'receiving', 'shipping', 'production', 'staging'];

const listLocationsSchema = Joi.object({
  warehouse: Joi.string().pattern(/^[a-f\d]{24}$/i).optional(),
  type:      Joi.string().valid(...LOCATION_TYPES).optional().messages({
    'any.only': `type must be one of: ${LOCATION_TYPES.join(', ')}`,
  }),
});

const router = express.Router();
router.use(verifyToken);

const anyStaff = requireRole('inventory_manager', 'admin', 'warehouse_staff');
const managers = requireRole('inventory_manager', 'admin');

router.get('/', anyStaff, async (req, res) => {
  try {
    // Validate and coerce query params
    const { error, value } = listLocationsSchema.validate(req.query, {
      abortEarly: true, stripUnknown: true,
    });
    if (error) {
      return sendError(res, 400, error.details[0].message.replace(/['"]/g, ''), 'VALIDATION_ERROR');
    }

    const filter = { isActive: true };
    if (value.warehouse) filter.warehouse = value.warehouse;
    if (value.type)      filter.type      = value.type;

    const locations = await Location.find(filter)
      .populate('warehouse', 'name code')
      .sort({ name: 1 });
    return sendSuccess(res, 200, 'Locations retrieved', { locations });
  } catch (err) { return sendError(res, 500, err.message, 'SERVER_ERROR'); }
});

router.get('/:id', anyStaff, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return sendError(res, 400, 'Invalid id', 'INVALID_ID');
    const location = await Location.findById(req.params.id).populate('warehouse', 'name code');
    if (!location) return sendError(res, 404, 'Location not found', 'NOT_FOUND');
    return sendSuccess(res, 200, 'Location retrieved', { location });
  } catch (err) { return sendError(res, 500, err.message, 'SERVER_ERROR'); }
});

router.post('/', managers, async (req, res) => {
  try {
    const { warehouse, name, type, parentLocation } = req.body;
    const location = await Location.create({ warehouse, name, type, parentLocation: parentLocation || null });
    return sendSuccess(res, 201, 'Location created', { location });
  } catch (err) { return sendError(res, 500, err.message, 'SERVER_ERROR'); }
});

router.patch('/:id', managers, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return sendError(res, 400, 'Invalid id', 'INVALID_ID');
    const location = await Location.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!location) return sendError(res, 404, 'Location not found', 'NOT_FOUND');
    return sendSuccess(res, 200, 'Location updated', { location });
  } catch (err) { return sendError(res, 500, err.message, 'SERVER_ERROR'); }
});

module.exports = router;
