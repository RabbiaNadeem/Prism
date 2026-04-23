'use strict';

const crypto = require('node:crypto');

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

function normalizeBaseUrl(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '');
}

function joinUrl(baseUrl, path) {
  const base = normalizeBaseUrl(baseUrl);
  const p = typeof path === 'string' ? path.trim() : '';
  if (!base) return '';
  if (!p) return base;
  if (p.startsWith('/')) return `${base}${p}`;
  return `${base}/${p}`;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

function stableId(prefix = 'chatcmpl') {
  // Avoid leaking user content in IDs.
  const rand = crypto.randomBytes(12).toString('hex');
  return `${prefix}_${rand}`;
}

function coerceOpenAIChatCompletion(upstream, requestedModel) {
  if (!upstream || typeof upstream !== 'object') {
    throw new Error('Invalid provider response: expected object');
  }

  const created = Number.isInteger(upstream.created) ? upstream.created : nowUnixSeconds();
  const model = typeof upstream.model === 'string' && upstream.model.trim() ? upstream.model : requestedModel || 'unknown';

  // Keep the response strictly OpenAI-compatible and stable across providers.
  const response = {
    id: typeof upstream.id === 'string' && upstream.id.trim() ? upstream.id : stableId('chatcmpl'),
    object: typeof upstream.object === 'string' && upstream.object.trim() ? upstream.object : 'chat.completion',
    created,
    model,
    choices: upstream.choices,
    usage: upstream.usage,
    system_fingerprint: upstream.system_fingerprint,
  };

  if (!Array.isArray(response.choices)) {
    throw new Error('Invalid provider response: missing choices[]');
  }

  // Ensure minimal OpenAI-compatible shape for each choice.
  response.choices = response.choices.map((c, index) => {
    const choice = c && typeof c === 'object' ? { ...c } : {};
    if (!Number.isInteger(choice.index)) choice.index = index;

    // Some OpenAI-compatible providers might return `delta` for streaming.
    // Non-streaming should have `message`.
    if (choice.message && typeof choice.message === 'object') {
      const role = safeString(choice.message.role) || 'assistant';
      const content = typeof choice.message.content === 'string' ? choice.message.content : choice.message.content == null ? '' : String(choice.message.content);
      choice.message = { ...choice.message, role, content };
    }

    if (typeof choice.finish_reason !== 'string' && choice.finish_reason != null) {
      choice.finish_reason = String(choice.finish_reason);
    }

    return choice;
  });

  return response;
}

async function fetchJsonWithTimeout(url, { method = 'POST', headers, body, timeoutMs } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Request timeout')), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    const text = await res.text().catch(() => '');
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        // ignore parse error; we still have `text` for debugging
      }
    }

    if (!res.ok) {
      const err = new Error(`Provider request failed: ${res.status}`);
      err.status = res.status;
      err.responseText = text;
      err.responseJson = json;
      throw err;
    }

    if (json == null) {
      const err = new Error('Provider response was not valid JSON');
      err.status = res.status;
      err.responseText = text;
      throw err;
    }

    return json;
  } finally {
    clearTimeout(timeout);
  }
}

function createOpenAICompatibleAdapter({
  name,
  baseUrl,
  apiKey,
  authMode = 'bearer',
  extraHeaders = {},
  path = '/chat/completions',
  timeoutMs = 15000,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';

  function buildHeaders() {
    const headers = {
      'content-type': 'application/json',
      ...extraHeaders,
    };

    if (key) {
      if (authMode === 'x-goog-api-key') {
        headers['x-goog-api-key'] = key;
      } else if (authMode === 'api-key') {
        headers['api-key'] = key;
      } else {
        headers.authorization = `Bearer ${key}`;
      }
    }

    // Remove undefined/null headers.
    Object.keys(headers).forEach((h) => {
      if (headers[h] == null) delete headers[h];
    });

    return headers;
  }

  return {
    name: safeString(name) || 'provider',
    isConfigured: () => !!(normalizedBaseUrl && key),
    async createChatCompletion(body, { log } = {}) {
      const url = joinUrl(normalizedBaseUrl, path);
      if (!url) throw new Error(`${name}: missing base URL`);
      if (!key) throw new Error(`${name}: missing API key`);

      log?.debug?.({ provider: name }, 'LLM provider request start');
      const json = await fetchJsonWithTimeout(url, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(body),
        timeoutMs,
      });
      return json;
    },
  };
}

function buildProviderChainFromEnv(env = process.env) {
  const timeoutMs = parsePositiveInt(env.LLM_PROVIDER_TIMEOUT_MS, 15000);

  const groq = createOpenAICompatibleAdapter({
    name: 'groq',
    baseUrl: env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    apiKey: env.GROQ_API_KEY,
    timeoutMs,
  });

  const geminiAuthMode = (env.GEMINI_AUTH_MODE || 'x-goog-api-key').toLowerCase();
  const gemini = createOpenAICompatibleAdapter({
    name: 'gemini',
    baseUrl: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: env.GEMINI_API_KEY,
    authMode: geminiAuthMode,
    timeoutMs,
  });

  const openrouter = createOpenAICompatibleAdapter({
    name: 'openrouter',
    baseUrl: env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: env.OPENROUTER_API_KEY,
    extraHeaders: {
      // Optional but recommended by OpenRouter.
      'http-referer': env.OPENROUTER_HTTP_REFERER,
      'x-title': env.OPENROUTER_X_TITLE,
    },
    timeoutMs,
  });

  return [groq, gemini, openrouter];
}

function pickBodyFields(input = {}) {
  // Keep this permissive but avoid sending internal fields.
  const allowed = [
    'model',
    'messages',
    'temperature',
    'top_p',
    'max_completion_tokens',
    'stream',
    'stop',
    'presence_penalty',
    'frequency_penalty',
    'response_format',
    'seed',
    'tools',
    'tool_choice',
    'parallel_tool_calls',
  ];

  const out = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined) {
      out[key] = input[key];
    }
  }

  return out;
}

function createLlmRouter(options = {}) {
  const providers = Array.isArray(options.providers) && options.providers.length > 0 ? options.providers : buildProviderChainFromEnv();
  const echoFallbackEnabled = String(options.echoFallbackEnabled ?? process.env.PRISM_ECHO_FALLBACK ?? 'false').toLowerCase() === 'true';

  function echoCompletion({ model, messages }) {
    const created = nowUnixSeconds();
    const lastUserMessage = Array.isArray(messages)
      ? [...messages].reverse().find((m) => m && m.role === 'user' && typeof m.content === 'string')
      : null;
    const content = lastUserMessage?.content ? `Echo: ${lastUserMessage.content}` : 'Echo: (no user message provided)';

    return {
      id: stableId('chatcmpl'),
      object: 'chat.completion',
      created,
      model: model || 'prism-echo',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        },
      ],
    };
  }

  async function tryProviders(body, { log } = {}) {
    const configured = providers.filter((p) => p && typeof p.isConfigured === 'function' && p.isConfigured());

    if (configured.length === 0) {
      const err = new Error('No LLM providers configured (missing API keys/base URLs)');
      err.statusCode = 500;
      throw err;
    }

    const errors = [];

    for (const provider of configured) {
      try {
        const upstream = await provider.createChatCompletion(body, { log });
        const normalized = coerceOpenAIChatCompletion(upstream, body.model);
        log?.info?.({ provider: provider.name }, 'LLM provider succeeded');
        return normalized;
      } catch (err) {
        errors.push({ provider: provider.name, err });
        log?.warn?.({ provider: provider.name, status: err?.status, err }, 'LLM provider failed (trying next)');
      }
    }

    const last = errors[errors.length - 1];

    if (echoFallbackEnabled) {
      log?.error?.({ errors: errors.map((e) => ({ provider: e.provider, status: e.err?.status, message: e.err?.message })) }, 'All providers failed; using echo fallback');
      return echoCompletion({ model: body.model, messages: body.messages });
    }

    const err = new Error('All LLM providers failed');
    err.statusCode = last?.err?.status || 502;
    err.cause = last?.err;
    throw err;
  }

  /**
   * OpenAI-compatible chat completion with optional caching.
   *
   * @param {object} params OpenAI request body (model, messages, etc.)
   * @param {object} ctx { cache, log }
   * @returns {Promise<{result: object, cacheStatus: 'HIT'|'MISS'|'BYPASS'}>}
   */
  async function createChatCompletion(params = {}, ctx = {}) {
    const body = pickBodyFields(params);
    const { cache, log } = ctx || {};

    const stream = body.stream === true;

    if (cache?.enabled && !stream) {
      const key = cache.chatKey({ model: body.model, messages: body.messages });

      try {
        const cached = await cache.get(key);
        if (cached) {
          log?.debug?.({ cache: 'HIT' }, 'AI cache hit');
          return { result: cached, cacheStatus: 'HIT' };
        }
      } catch (err) {
        log?.warn?.({ err }, 'AI cache read failed (bypassing)');
      }

      const result = await tryProviders(body, { log });

      try {
        await cache.set(key, result);
      } catch (err) {
        log?.warn?.({ err }, 'AI cache write failed (bypassing)');
      }

      return { result, cacheStatus: 'MISS' };
    }

    const result = await tryProviders(body, { log });
    return { result, cacheStatus: 'BYPASS' };
  }

  return { createChatCompletion };
}

module.exports = { createLlmRouter, createOpenAICompatibleAdapter };
