'use strict';

const { observeRequest } = require('../observability/metrics');

function normalizeRouteLabel(req) {
  const base = typeof req.baseUrl === 'string' ? req.baseUrl : '';
  const routePath = req.route?.path;
  if (typeof routePath === 'string') return `${base}${routePath}`;
  if (typeof req.path === 'string' && req.path.trim()) return req.path;
  return req.originalUrl?.split('?')[0] || 'unknown';
}

function requestMetrics(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    observeRequest({
      route: normalizeRouteLabel(req),
      method: req.method || 'UNKNOWN',
      status: res.statusCode || 0,
      durationMs: elapsedMs,
    });
  });

  next();
}

module.exports = { requestMetrics };
