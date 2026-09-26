'use strict';

const express = require('express');
const { verifyToken }  = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');
const { validate }     = require('../middleware/validate.middleware');
const {
  createReceiptSchema,
  updateReceiptSchema,
  addLineSchema,
  receiveQtySchema,
} = require('../validators/receipt.validator');
const ctrl = require('../controllers/receipt.controller');

const router = express.Router();

// All receipt routes require a valid JWT
router.use(verifyToken);

// Role shortcuts
const anyStaff  = requireRole('inventory_manager', 'admin', 'warehouse_staff');
const managers  = requireRole('inventory_manager', 'admin');

// ─── Static routes FIRST (before /:id) ────────────────────────────────────────

// GET  /api/receipts/pending-count  — Dashboard KPI
router.get('/pending-count', anyStaff, ctrl.pendingCount);

// GET  /api/receipts
router.get('/', anyStaff, ctrl.list);

// POST /api/receipts
router.post('/', managers, validate(createReceiptSchema), ctrl.create);

// ─── Parameterised routes ──────────────────────────────────────────────────────

// GET   /api/receipts/:id
router.get('/:id', anyStaff, ctrl.getById);

// PATCH /api/receipts/:id
router.patch('/:id', managers, validate(updateReceiptSchema), ctrl.update);

// POST  /api/receipts/:id/lines         — add a single line
router.post('/:id/lines', managers, validate(addLineSchema), ctrl.addLine);

// DELETE /api/receipts/:id/lines/:lineId — remove a line
router.delete('/:id/lines/:lineId', managers, ctrl.removeLine);

// PATCH /api/receipts/:id/lines/:lineId/receive — enter received qty
// warehouse_staff CAN enter quantities; only managers can VALIDATE
router.patch('/:id/lines/:lineId/receive', anyStaff, validate(receiveQtySchema), ctrl.receiveQty);

// POST /api/receipts/:id/validate  — managers only
router.post('/:id/validate', managers, ctrl.validate);

// POST /api/receipts/:id/cancel
router.post('/:id/cancel', managers, ctrl.cancel);

module.exports = router;
