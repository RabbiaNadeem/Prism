const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function buildHeaders(apiKey) {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
  };
}

function parseErrorMessage(status, payload) {
  if (status === 401) return 'Unauthorized. Check your Prism API key.';
  if (status === 429) return 'Rate limit reached. Wait and try again.';
  if (status === 400) return payload?.error || 'Request blocked by validation or prompt safety.';
  return payload?.error || 'Request failed. Please try again.';
}

export async function createChatCompletion({ apiKey, model, messages }) {
  const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      model: model || 'gpt-4.1-mini',
      messages,
      stream: false,
    }),
  });

  const data = await response.json().catch(() => ({}));
  const meta = {
    cacheStatus: response.headers.get('X-Cache'),
    rateLimitLimit: response.headers.get('X-RateLimit-Limit'),
    rateLimitRemaining: response.headers.get('X-RateLimit-Remaining'),
    retryAfter: response.headers.get('Retry-After'),
  };

  if (!response.ok) {
    const error = new Error(parseErrorMessage(response.status, data));
    error.status = response.status;
    error.meta = meta;
    throw error;
  }

  return { data, meta };
}
