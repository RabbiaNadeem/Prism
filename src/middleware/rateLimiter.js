'use strict';

const crypto = require('node:crypto');

const { Redis } = require('@upstash/redis');
const { recordRateLimit } = require('../observability/metrics');

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requireEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || !value.trim()) {
    const err = new Error(`Rate limiter misconfigured: missing ${name}`);
    err.statusCode = 500;
    throw err;
  }
  return value.trim();
}

function hashKey(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
redis.call('ZADD', key, now, member)
local count = redis.call('ZCARD', key)
redis.call('PEXPIRE', key, window)

if count <= limit then
  return {count, 0}
end

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestScore = tonumber(oldest[2]) or now
local retryAfter = (oldestScore + window) - now
if retryAfter < 0 then retryAfter = 0 end
return {count, retryAfter}
`;

function createRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000);
  const max = options.max ?? parsePositiveInt(process.env.RATE_LIMIT_MAX, 60);
  const prefix = options.prefix ?? process.env.RATE_LIMIT_PREFIX ?? 'prism:ratelimit';

  // Enforce Redis configuration so this never silently falls back to in-memory in production.
  requireEnv('UPSTASH_REDIS_REST_URL');
  requireEnv('UPSTASH_REDIS_REST_TOKEN');

  const redis = options.redis ?? Redis.fromEnv();

  return async function rateLimiter(req, res, next) {
    try {
      const apiKey = req.apiKey;
      if (typeof apiKey !== 'string' || !apiKey.trim()) {
        const err = new Error('Rate limiter requires authenticated API key');
        err.statusCode = 500;
        throw err;
      }

      const now = Date.now();
      const member = `${now}:${crypto.randomUUID()}`;
      const redisKey = `${prefix}:${hashKey(apiKey)}`;

      const result = await redis.eval(
        SLIDING_WINDOW_LUA,
        [redisKey],
        [String(now), String(windowMs), String(max), member],
      );

      const count = Number(result?.[0] ?? 0);
      const retryAfterMs = Number(result?.[1] ?? 0);
      const remaining = Math.max(0, max - count);

      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(remaining));

      if (retryAfterMs > 0) {
        res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
        recordRateLimit('throttled');
        const err = new Error('Rate limit exceeded');
        err.statusCode = 429;
        throw err;
      }

      recordRateLimit('allowed');
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { createRateLimiter };
