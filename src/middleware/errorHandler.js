'use strict';

const { recordError } = require('../observability/metrics');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode =
    Number.isInteger(err?.statusCode) ? err.statusCode : Number.isInteger(err?.status) ? err.status : 500;

  const message = statusCode >= 500 ? 'Internal Server Error' : err?.message || 'Request failed';
  const route = req?.originalUrl?.split('?')[0] || req?.path || 'unknown';
  const kind = err?.name || 'Error';

  recordError({ route, status: statusCode, kind });

  req.log?.error({ err, statusCode }, 'Request error');

  return res.status(statusCode).json({
    error: message,
  });
}

module.exports = { errorHandler };
