'use strict';

const { sendError } = require('../utils/apiResponse');

/**
 * Factory — returns an Express middleware that validates req.body against
 * the supplied Joi schema.  Aborts with 422 on the first validation error.
 *
 * Usage:
 *   router.post('/signup', validate(signupSchema), authController.signup);
 *
 * @param {import('joi').ObjectSchema} schema
 * @returns {import('express').RequestHandler}
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: true,    // stop at the first error to keep messages clean
      stripUnknown: true,  // silently drop keys not in the schema
      convert: true,       // allow Joi to coerce types (e.g. trim, lowercase)
    });

    if (error) {
      const message = error.details[0].message.replace(/['"]/g, '');
      return sendError(res, 422, message, 'VALIDATION_ERROR');
    }

    // Replace req.body with the sanitised + coerced value
    req.body = value;
    next();
  };
}

module.exports = { validate };
