'use strict';

function getAuthToken(req) {
  const headerValue = req.get('authorization');
  if (typeof headerValue === 'string' && headerValue.toLowerCase().startsWith('bearer ')) {
    return headerValue.slice('bearer '.length).trim();
  }

  const apiKeyHeader = req.get('x-api-key');
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim()) {
    return apiKeyHeader.trim();
  }

  return null;
}

function parseApiKeys(value) {
  if (typeof value !== 'string' || !value.trim()) return [];

  // Allow comma-separated and/or newline-separated keys.
  return value
    .split(/[,\r\n]+/)
    .map((key) => key.trim())
    .filter(Boolean);
}

function getExpectedApiKeys() {
  const keys = parseApiKeys(process.env.PRISM_API_KEYS);
  if (keys.length > 0) return keys;

  // Backwards-compat: single key.
  return parseApiKeys(process.env.PRISM_API_KEY);
}

function auth(req, res, next) {
  const expectedKeys = getExpectedApiKeys();

  // If no key is configured, reject requests to force testing with API keys.
  if (expectedKeys.length === 0) {
    const err = new Error('Unauthorized: no API keys configured');
    err.statusCode = 401;
    return next(err);
  }

  const provided = getAuthToken(req);

  if (!provided || !expectedKeys.includes(provided)) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    return next(err);
  }

  return next();
}

module.exports = { auth };
