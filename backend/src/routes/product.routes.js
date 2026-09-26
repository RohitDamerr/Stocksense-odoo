'use strict';

const express    = require('express');
const { verifyToken }  = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');
const { validate }     = require('../middleware/validate.middleware');
const {
  createProductSchema,
  updateProductSchema,
} = require('../validators/product.validator');
const productController = require('../controllers/product.controller');

const router = express.Router();

// All product routes require authentication
router.use(verifyToken);

const canWrite = requireRole('inventory_manager', 'admin');
const canRead  = requireRole('inventory_manager', 'admin', 'warehouse_staff');

// ─── IMPORTANT: static routes BEFORE /:id so Express matches them correctly ───

// GET /api/products/reorder-alerts — products below reorder threshold
router.get('/reorder-alerts', canRead, productController.reorderAlerts);

// GET /api/products — paginated list with aggregated stock totals
router.get('/', canRead, productController.list);

// POST /api/products — create product (+ optional initial stock in a transaction)
router.post('/', canWrite, validate(createProductSchema), productController.create);

// GET /api/products/:id — single product with per-location stock breakdown
router.get('/:id', canRead, productController.getById);

// PATCH /api/products/:id — update product fields (NOT stock quantities)
router.patch('/:id', canWrite, validate(updateProductSchema), productController.update);

// DELETE /api/products/:id — soft deactivate (rejects if stock > 0)
router.delete('/:id', canWrite, productController.deactivate);

module.exports = router;
