'use strict';

const crypto = require('node:crypto');

const { Redis } = require('@upstash/redis');

function hasUpstashEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return typeof url === 'string' && !!url.trim() && typeof token === 'string' && !!token.trim();
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m) => {
      const role = typeof m?.role === 'string' ? m.role : undefined;
      const content = typeof m?.content === 'string' ? m.content.trim() : undefined;
      if (!role && !content) return null;
      return { role, content };
    })
    .filter(Boolean);
}

function buildChatCacheKey({ model, messages, prefix } = {}) {
  const safeModel = typeof model === 'string' && model.trim() ? model.trim() : '';
  const safePrefix = typeof prefix === 'string' && prefix.trim() ? prefix.trim() : 'prism:chatcache';
  const prompt = JSON.stringify({ model: safeModel, messages: normalizeMessages(messages) });
  return `${safePrefix}:${sha256Hex(prompt)}`;
}

function createAiCache(options = {}) {
  const enabledValue = options.enabled ?? process.env.AI_CACHE_ENABLED ?? 'true';
  const enabled = String(enabledValue).toLowerCase() !== 'false';

  const ttlSeconds = options.ttlSeconds ?? parsePositiveInt(process.env.AI_CACHE_TTL_SECONDS, 600);
  const prefix = options.prefix ?? process.env.AI_CACHE_PREFIX ?? 'prism:chatcache';

  // Allow injecting a redis client (useful for tests), otherwise use Upstash if configured.
  const redis = options.redis ?? (hasUpstashEnv() ? Redis.fromEnv() : null);

  return {
    enabled: enabled && !!redis,
    ttlSeconds,
    prefix,
    redis,
    chatKey: ({ model, messages }) => buildChatCacheKey({ model, messages, prefix }),
    async get(key) {
      if (!enabled || !redis) return null;
      return redis.get(key);
    },
    async set(key, value) {
      if (!enabled || !redis) return;
      await redis.set(key, value, { ex: ttlSeconds });
    },
  };
}

module.exports = { createAiCache, buildChatCacheKey };
