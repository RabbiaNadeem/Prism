'use strict';

function getAdminSecret(req) {
  const headerValue = req.get('x-admin-secret');
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  return null;
}

function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_SECRET;
  if (typeof expected !== 'string' || !expected.trim()) {
    const err = new Error('Forbidden: admin secret not configured');
    err.statusCode = 403;
    return next(err);
  }

  const provided = getAdminSecret(req);
  if (!provided || provided !== expected.trim()) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    return next(err);
  }

  return next();
}

module.exports = { adminAuth };
