'use strict';

const { recordError } = require('../observability/metrics');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode =
    Number.isInteger(err?.statusCode) ? err.statusCode : Number.isInteger(err?.status) ? err.status : 500;

  const exposeUpstream = err?.exposeUpstreamFailure === true;
  const exposeDetails =
    exposeUpstream &&
    (process.env.NODE_ENV !== 'production' || process.env.PRISM_EXPOSE_UPSTREAM_ERRORS === 'true');

  const message =
    statusCode >= 500 && !exposeUpstream ? 'Internal Server Error' : err?.message || 'Request failed';
  const route = req?.originalUrl?.split('?')[0] || req?.path || 'unknown';
  const kind = err?.name || 'Error';

  recordError({ route, status: statusCode, kind });

  req.log?.error({ err, statusCode }, 'Request error');


  const payload = {
    error: message,
  };
  if (exposeDetails && err?.details) {
    payload.details = err.details;
  }

  return res.status(statusCode).json(payload);
}

module.exports = { errorHandler };
