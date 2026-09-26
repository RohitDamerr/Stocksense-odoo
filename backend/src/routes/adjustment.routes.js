'use strict';

const express = require('express');
const { verifyToken }  = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');
const { validate }     = require('../middleware/validate.middleware');
const {
  createAdjustmentSchema,
  addLineSchema,
  countLineSchema,
} = require('../validators/adjustment.validator');
const ctrl = require('../controllers/adjustment.controller');

const router = express.Router();
router.use(verifyToken);

// warehouse_staff can create drafts and enter counts (counting is their job)
const anyStaff = requireRole('inventory_manager', 'admin', 'warehouse_staff');
// Only managers can validate — a count discrepancy should be reviewed before correcting stock
const managers = requireRole('inventory_manager', 'admin');

// ── Static routes BEFORE /:id ──────────────────────────────────────────────────

router.get('/',    anyStaff, ctrl.list);
router.post('/',   anyStaff, validate(createAdjustmentSchema), ctrl.create);

// ── Parameterised routes ───────────────────────────────────────────────────────

router.get   ('/:id',                           anyStaff, ctrl.getById);

// Line management (warehouse_staff can add lines and enter counts)
router.post  ('/:id/lines',                     anyStaff, validate(addLineSchema), ctrl.addLine);
router.delete('/:id/lines/:lineId',             anyStaff, ctrl.removeLine);

// Enter counted quantity — the core "count" step
router.patch ('/:id/lines/:lineId/count',       anyStaff, validate(countLineSchema), ctrl.countLine);

// Validate (managers only) + cancel (managers only — they own the correction)
router.post  ('/:id/validate',                  managers, ctrl.validate);
router.post  ('/:id/cancel',                    managers, ctrl.cancel);

module.exports = router;
