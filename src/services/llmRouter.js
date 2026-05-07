'use strict';

const crypto = require('node:crypto');
const { recordProvider, recordInputTokens, recordOutputTokens } = require('../observability/metrics');
const { estimateInputTokens, estimateOutputTokens } = require('../observability/tokenEstimator');

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

function parseApiKeysFromEnv(env, { primaryKey, listKey } = {}) {
  const parts = [];

  const primary = safeString(env?.[primaryKey]);
  const list = safeString(env?.[listKey]);

  // Support comma OR newline separated values in either var.
  for (const source of [primary, list]) {
    if (!source.trim()) continue;
    for (const raw of source.split(/[\n,]+/g)) {
      const key = raw.trim();
      if (key) parts.push(key);
    }
  }

  // De-dupe while keeping order (don’t leak count by logging).
  const seen = new Set();
  return parts.filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
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

  const groqKeys = parseApiKeysFromEnv(env, { primaryKey: 'GROQ_API_KEY', listKey: 'GROQ_API_KEYS' });
  const groqAdapters = groqKeys.map((apiKey, i) =>
    createOpenAICompatibleAdapter({
      name: `groq-${i + 1}`,
      baseUrl: env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      apiKey,
      timeoutMs,
    }),
  );

  const geminiAuthMode = (env.GEMINI_AUTH_MODE || 'x-goog-api-key').toLowerCase();
  const geminiKeys = parseApiKeysFromEnv(env, { primaryKey: 'GEMINI_API_KEY', listKey: 'GEMINI_API_KEYS' });
  const geminiAdapters = geminiKeys.map((apiKey, i) =>
    createOpenAICompatibleAdapter({
      name: `gemini-${i + 1}`,
      baseUrl: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey,
      authMode: geminiAuthMode,
      timeoutMs,
    }),
  );

  // Order matters: try Groq keys first, then Gemini keys.
  return [...groqAdapters, ...geminiAdapters];
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

  // If caller did not specify a model, default to auto-routing.
  if (typeof out.model !== 'string' || !out.model.trim()) {
    out.model = 'auto';
  }

  return out;
}

function createLlmRouter(options = {}) {
  const providers = Array.isArray(options.providers) && options.providers.length > 0 ? options.providers : buildProviderChainFromEnv();
  const echoFallbackEnabled = String(options.echoFallbackEnabled ?? process.env.PRISM_ECHO_FALLBACK ?? 'false').toLowerCase() === 'true';
  const autoModelOrder = [
    // Groq first.
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    // Then Gemini.
    'gemini-2.5-flash',
    'gemini-2.5-pro',
  ];

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

  async function tryProviders(body, { log, providerHint } = {}) {
    let configured = providers.filter((p) => p && typeof p.isConfigured === 'function' && p.isConfigured());

    if (configured.length === 0) {
      const err = new Error('No LLM providers configured (missing API keys/base URLs)');
      err.statusCode = 500;
      throw err;
    }

    if (typeof providerHint === 'string' && providerHint.trim()) {
      const hint = providerHint.trim().toLowerCase();
      const restricted = configured.filter((p) => p.name === hint);
      if (restricted.length === 0) {
        const err = new Error(`Provider not configured: ${hint}`);
        err.statusCode = 400;
        throw err;
      }
      configured = restricted;
    }

    const errors = [];

    const isAutoModel = String(body?.model || '').trim().toLowerCase() === 'auto';

    for (const provider of configured) {
      const candidateModels = isAutoModel ? autoModelOrder : [body.model];
      for (const candidateModel of candidateModels) {
        try {
          const upstream = await provider.createChatCompletion({ ...body, model: candidateModel }, { log });
          const normalized = coerceOpenAIChatCompletion(upstream, candidateModel);
          recordProvider(provider.name, 'success');
          log?.info?.({ provider: provider.name, model: candidateModel }, 'LLM provider succeeded');
          return { result: normalized, providerUsed: provider.name, modelUsed: normalized.model || candidateModel };
        } catch (err) {
          recordProvider(provider.name, 'failure');
          errors.push({ provider: provider.name, model: candidateModel, err });
          log?.warn?.({ provider: provider.name, model: candidateModel, status: err?.status, err }, 'LLM provider failed (trying next)');
        }
      }
    }

    const last = errors[errors.length - 1];

    if (echoFallbackEnabled) {
      log?.error?.({ errors: errors.map((e) => ({ provider: e.provider, status: e.err?.status, message: e.err?.message })) }, 'All providers failed; using echo fallback');
      const echoed = echoCompletion({ model: body.model, messages: body.messages });
      return { result: echoed, providerUsed: 'echo', modelUsed: echoed.model || body.model };
    }

    const err = new Error('All LLM providers failed');
    err.statusCode = last?.err?.status || 502;
    err.cause = last?.err;
    err.exposeUpstreamFailure = true;
    err.details = {
      attempts: errors.map(({ provider, model, err: e }) => ({
        provider,
        model,
        httpStatus: Number.isInteger(e?.status) ? e.status : null,
        code: typeof e?.code === 'string' ? e.code : undefined,
      })),
      modelRequested: typeof body?.model === 'string' ? body.model : undefined,
      hint:
        'Each provider receives the same `model`; use IDs valid for Groq/Gemini. If you configured multiple keys, Prism will try them in order (groq-1, groq-2, … then gemini-1, …).',
    };
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
    const providerHint = typeof params?.provider === 'string' ? params.provider.trim() : '';
    const { cache, log } = ctx || {};
    const modelLabel = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : 'auto';
    const estimatedInputTokens = Number.isInteger(params?.usage?.prompt_tokens)
      ? params.usage.prompt_tokens
      : estimateInputTokens(body.messages);
    recordInputTokens(modelLabel, estimatedInputTokens);

    const stream = body.stream === true;

    if (cache?.enabled && !stream) {
      const key = cache.chatKey({ model: body.model, messages: body.messages, provider: providerHint || undefined });

      try {
        const cached = await cache.get(key);
        if (cached) {
          const cachedOutputTokens = estimateOutputTokens(cached);
          recordOutputTokens(modelLabel, cachedOutputTokens);
          log?.debug?.({ cache: 'HIT' }, 'AI cache hit');
          return { result: cached, cacheStatus: 'HIT' };
        }
      } catch (err) {
        log?.warn?.({ err }, 'AI cache read failed (bypassing)');
      }

      const upstreamResult = await tryProviders(body, { log, providerHint });
      const result = upstreamResult?.result ?? upstreamResult;
      const outputTokens = estimateOutputTokens(result);
      recordOutputTokens(modelLabel, outputTokens);

      try {
        await cache.set(key, result);
      } catch (err) {
        log?.warn?.({ err }, 'AI cache write failed (bypassing)');
      }

      return {
        result,
        cacheStatus: 'MISS',
        providerUsed: upstreamResult?.providerUsed,
        modelUsed: upstreamResult?.modelUsed,
      };
    }

    const upstreamResult = await tryProviders(body, { log, providerHint });
    const result = upstreamResult?.result ?? upstreamResult;
    const outputTokens = estimateOutputTokens(result);
    recordOutputTokens(modelLabel, outputTokens);
    return { result, cacheStatus: 'BYPASS', providerUsed: upstreamResult?.providerUsed, modelUsed: upstreamResult?.modelUsed };
  }

  return { createChatCompletion };
}

module.exports = { createLlmRouter, createOpenAICompatibleAdapter };
