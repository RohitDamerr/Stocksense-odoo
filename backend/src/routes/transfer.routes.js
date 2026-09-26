'use strict';

const express = require('express');
const { verifyToken }  = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');
const { validate }     = require('../middleware/validate.middleware');
const {
  createTransferSchema,
  updateTransferSchema,
  addLineSchema,
} = require('../validators/transfer.validator');
const ctrl = require('../controllers/transfer.controller');

const router = express.Router();
router.use(verifyToken);

// All authenticated users can view and perform operational steps
const anyStaff = requireRole('inventory_manager', 'admin', 'warehouse_staff');

// Create, edit, add/remove lines — warehouse_staff included (per spec: "perform transfers")
const allRoles = requireRole('inventory_manager', 'admin', 'warehouse_staff');

// ── DESIGN DECISION (explicitly documented per spec instruction) ───────────────
// Validation is open to warehouse_staff, inventory_manager, and admin.
// Rationale: internal transfers don't cross a financial or vendor boundary
// (unlike Receipts which increase liability, or Deliveries which fulfil orders).
// A warehouse staff member confirming and validating an intra-warehouse move
// is their primary job. This is an intentional, reviewable policy — not an oversight.
const validateRole = requireRole('inventory_manager', 'admin', 'warehouse_staff');

// ── Static routes BEFORE /:id ──────────────────────────────────────────────────

router.get('/scheduled-count', anyStaff, ctrl.scheduledCount);
router.get('/',                anyStaff, ctrl.list);
router.post('/',               allRoles, validate(createTransferSchema), ctrl.create);

// ── Parameterised routes ───────────────────────────────────────────────────────

router.get   ('/:id',                         anyStaff,     ctrl.getById);
router.patch ('/:id',                         allRoles,     validate(updateTransferSchema), ctrl.update);

// Line management
router.post  ('/:id/lines',                   allRoles,     validate(addLineSchema), ctrl.addLine);
router.delete('/:id/lines/:lineId',           allRoles,     ctrl.removeLine);

// Confirm a line (availability check without committing stock)
router.patch ('/:id/lines/:lineId/confirm',   allRoles,     ctrl.confirmLine);

// Validate + cancel
router.post  ('/:id/validate',                validateRole, ctrl.validate);
router.post  ('/:id/cancel',                  allRoles,     ctrl.cancel);

module.exports = router;
