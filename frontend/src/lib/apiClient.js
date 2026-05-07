const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function buildHeaders(apiKey) {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
  };
}

function formatUpstreamDetails(details) {
  if (!details || typeof details !== 'object') return '';
  const attempts = Array.isArray(details.attempts)
    ? details.attempts
        .map((a) => `${a.provider ?? '?'}:${a.httpStatus != null ? a.httpStatus : (a.code ?? '?')}`)
        .join(', ')
    : '';
  const parts = [attempts ? `upstream: ${attempts}` : '', details.modelRequested ? `model: ${details.modelRequested}` : '', typeof details.hint === 'string' ? details.hint : ''].filter(
    Boolean,
  );
  return parts.length ? `\n${parts.join(' — ')}` : '';
}

function parseErrorMessage(status, payload) {
  const base =
    status === 401
      ? 'Unauthorized. Check your Prism API key.'
      : status === 429
        ? 'Rate limit reached. Wait and try again.'
        : status === 400
          ? payload?.error || 'Request blocked by validation or prompt safety.'
          : payload?.error || 'Request failed. Please try again.';
  if (payload?.details && status !== 401) return base + formatUpstreamDetails(payload.details);
  return base;
}

export async function createChatCompletion({ apiKey, provider, model, messages }) {
  const body = {
    model: model || 'auto',
    messages,
    stream: false,
  };
  if (typeof provider === 'string' && provider.trim()) {
    body.provider = provider.trim();
  }

  const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  const meta = {
    cacheStatus: response.headers.get('X-Cache'),
    rateLimitLimit: response.headers.get('X-RateLimit-Limit'),
    rateLimitRemaining: response.headers.get('X-RateLimit-Remaining'),
    retryAfter: response.headers.get('Retry-After'),
    providerUsed: response.headers.get('X-Prism-Provider'),
    modelUsed: response.headers.get('X-Prism-Model'),
  };

  if (!response.ok) {
    const error = new Error(parseErrorMessage(response.status, data));
    error.status = response.status;
    error.meta = meta;
    if (data?.details) error.details = data.details;
    throw error;
  }

  return { data, meta };
}
