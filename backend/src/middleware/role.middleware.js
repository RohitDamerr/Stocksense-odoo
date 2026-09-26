'use strict';

const { sendError } = require('../utils/apiResponse');

/**
 * requireRole — Role-based access control guard.
 *
 * Must be used AFTER verifyToken (depends on req.user being set).
 *
 * Usage:
 *   // Only inventory_manager and admin can validate receipts
 *   router.post('/receipts/:id/validate',
 *     verifyToken,
 *     requireRole('inventory_manager', 'admin'),
 *     receiptController.validate
 *   );
 *
 * @param {...string} roles  One or more allowed role strings
 * @returns {import('express').RequestHandler}
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      // Should never reach here without verifyToken, but guard defensively
      return sendError(res, 401, 'Not authenticated', 'NOT_AUTHENTICATED');
    }

    if (!roles.includes(req.user.role)) {
      return sendError(
        res,
        403,
        `This action requires one of the following roles: ${roles.join(', ')}`,
        'FORBIDDEN'
      );
    }

    next();
  };
}

module.exports = { requireRole };
