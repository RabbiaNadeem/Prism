'use strict';

const crypto = require('node:crypto');

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
  // Primary config: single (or comma/newline separated) client key(s).
  const singleAllowed = parseApiKeys(process.env.ALLOWED_API_KEY);
  if (singleAllowed.length > 0) return singleAllowed;

  // Optional allow-list.
  const allowed = parseApiKeys(process.env.ALLOWED_API_KEYS);
  if (allowed.length > 0) return allowed;

  // Backwards-compat: older env var.
  const keys = parseApiKeys(process.env.PRISM_API_KEYS);
  if (keys.length > 0) return keys;

  return parseApiKeys(process.env.PRISM_API_KEY);
}

function safeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isAllowedApiKey(provided, expectedKeys) {
  // Avoid Array.includes() string comparison timing quirks.
  return expectedKeys.some((expected) => safeEquals(expected, provided));
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

  if (!provided || !isAllowedApiKey(provided, expectedKeys)) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    return next(err);
  }

  // Make the validated key available to downstream middleware (e.g., rate limiter).
  req.apiKey = provided;

  return next();
}

module.exports = { auth };
