'use strict';

const express    = require('express');
const { verifyToken }  = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');
const { validate }     = require('../middleware/validate.middleware');
const {
  createCategorySchema,
  updateCategorySchema,
} = require('../validators/product.validator');
const categoryController = require('../controllers/category.controller');

const router = express.Router();

// All category routes require authentication
router.use(verifyToken);

// Write operations: inventory_manager + admin only
const canWrite = requireRole('inventory_manager', 'admin');
// Read operations: all authenticated roles
const canRead  = requireRole('inventory_manager', 'admin', 'warehouse_staff');

// GET /api/categories — nested tree of all categories
router.get('/', canRead, categoryController.list);

// POST /api/categories — create a category
router.post('/', canWrite, validate(createCategorySchema), categoryController.create);

// PATCH /api/categories/:id — rename or reparent
router.patch('/:id', canWrite, validate(updateCategorySchema), categoryController.update);

// DELETE /api/categories/:id — delete (blocked if products reference it)
router.delete('/:id', canWrite, categoryController.remove);

module.exports = router;
