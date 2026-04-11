'use strict';
const { env } = process;

async function callProvider(url, apiKey, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: apiKey ? `Bearer ${apiKey}` : undefined,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>');
    const err = new Error(`Provider request failed: ${res.status} ${text}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

function echoCompletion({ model, messages }) {
  const created = Math.floor(Date.now() / 1000);
  const lastUserMessage = Array.isArray(messages)
    ? [...messages].reverse().find((m) => m && m.role === 'user' && typeof m.content === 'string')
    : null;
  const content = lastUserMessage?.content
    ? `Echo: ${lastUserMessage.content}`
    : 'Echo: (no user message provided)';

  return {
    id: `chatcmpl_${created}`,
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

async function createChatCompletion({ model, messages, temperature = 1, max_completion_tokens = 512, top_p = 1, stream = false, stop = null } = {}) {
  // Determine provider preference: explicit env DEFAULT_PROVIDER, else prefer GROQ if key present, else OpenRouter if key present
  const defaultProvider = (env.DEFAULT_PROVIDER || '').toLowerCase();

  const groqKey = env.GROQ_API_KEY;
  const groqBase = env.GROQ_BASE_URL || '';
  const openKey = env.OPENROUTER_API_KEY;
  const openBase = env.OPENROUTER_BASE_URL || '';

  const preferGroq = defaultProvider === 'groq' || (defaultProvider === '' && !!groqKey);

  try {
    if (preferGroq && groqKey && groqBase) {
      const url = `${groqBase.replace(/\/$/, '')}/v1/chat/completions`;
      const body = { model, messages, temperature, max_completion_tokens, top_p, stream, stop };
      const result = await callProvider(url, groqKey, body);
      return result;
    }

    if (!preferGroq && openKey && openBase) {
      const url = `${openBase.replace(/\/$/, '')}/v1/chat/completions`;
      const body = { model, messages, temperature, max_completion_tokens, top_p, stream, stop };
      const result = await callProvider(url, openKey, body);
      return result;
    }

    // If keys exist but base URLs missing, throw for clarity
    if ((groqKey && !groqBase) || (openKey && !openBase)) {
      throw new Error('Provider API key present but base URL missing in env (GROQ_BASE_URL or OPENROUTER_BASE_URL)');
    }
  } catch (err) {
    // Log and fall through to echo fallback
    // eslint-disable-next-line no-console
    console.error('Provider call failed, falling back to echo:', err && err.message ? err.message : err);
  }

  return echoCompletion({ model, messages });
}

module.exports = { createChatCompletion };
