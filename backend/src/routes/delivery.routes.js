'use strict';

const express = require('express');
const { verifyToken }  = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');
const { validate }     = require('../middleware/validate.middleware');
const {
  createDeliveryOrderSchema,
  updateDeliveryOrderSchema,
  addLineSchema,
  pickQtySchema,
  packQtySchema,
} = require('../validators/delivery.validator');
const ctrl = require('../controllers/delivery.controller');

const router = express.Router();

router.use(verifyToken);

const anyStaff = requireRole('inventory_manager', 'admin', 'warehouse_staff');
const managers = requireRole('inventory_manager', 'admin');

// ── Static routes BEFORE /:id ─────────────────────────────────────────────────

router.get('/pending-count', anyStaff, ctrl.pendingCount);
router.get('/',              anyStaff, ctrl.list);
router.post('/',             managers, validate(createDeliveryOrderSchema), ctrl.create);

// ── Parameterised routes ──────────────────────────────────────────────────────

router.get   ('/:id',                            anyStaff, ctrl.getById);
router.patch ('/:id',                            managers, validate(updateDeliveryOrderSchema), ctrl.update);

// Line management
router.post  ('/:id/lines',                      managers, validate(addLineSchema), ctrl.addLine);
router.delete('/:id/lines/:lineId',              managers, ctrl.removeLine);

// Pick + pack — warehouse_staff performs these
router.patch ('/:id/lines/:lineId/pick',         anyStaff, validate(pickQtySchema), ctrl.pickLine);
router.patch ('/:id/lines/:lineId/pack',         anyStaff, validate(packQtySchema), ctrl.packLine);

// Validate (managers only) + cancel
router.post  ('/:id/validate',                   managers, ctrl.validate);
router.post  ('/:id/cancel',                     managers, ctrl.cancel);

module.exports = router;
