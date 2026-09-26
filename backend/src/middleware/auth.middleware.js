'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const { sendError }         = require('../utils/apiResponse');

/**
 * verifyToken — Extract and verify the JWT from the Authorization header.
 *
 * Expects:  Authorization: Bearer <accessToken>
 *
 * On success, attaches to req:
 *   req.user = { userId: string, role: string }
 *
 * On failure, responds immediately with 401.
 *
 * @type {import('express').RequestHandler}
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Access token missing or malformed', 'TOKEN_MISSING');
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Access token has expired', 'TOKEN_EXPIRED');
    }
    return sendError(res, 401, 'Access token is invalid', 'TOKEN_INVALID');
  }
}

module.exports = { verifyToken };
