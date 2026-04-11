'use strict';

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000);
  const max = options.max ?? parsePositiveInt(process.env.RATE_LIMIT_MAX, 60);

  const hits = new Map();

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';

    const existing = hits.get(key);

    if (!existing || now >= existing.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    existing.count += 1;

    if (existing.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      const err = new Error('Rate limit exceeded');
      err.statusCode = 429;
      return next(err);
    }

    return next();
  };
}

module.exports = { createRateLimiter };
