# Prism

AI API gateway that can route between LLMs.

## Getting started

```bash
npm install
npm start
```

## Security

### API key authentication

All `/v1/*` endpoints require an API key.

- Header: `x-api-key: <key>`
- Or: `Authorization: Bearer <key>`

Configure allowed keys via:

- `ALLOWED_API_KEY` — primary (can also be comma/newline separated)
- Optional allow-list: `ALLOWED_API_KEYS`
- Backwards-compatible: `PRISM_API_KEYS`, `PRISM_API_KEY`

Admin-only routes (when added, e.g. `/admin/*`) should use `ADMIN_SECRET`.

### Redis rate limiting (sliding window per API key)

Rate limiting is enforced per API key using Upstash Redis (REST).

Required env:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional env:

- `RATE_LIMIT_WINDOW_MS` (default `60000`)
- `RATE_LIMIT_MAX` (default `60`)
- `RATE_LIMIT_PREFIX` (default `prism:ratelimit`)

When limited, the API returns `429` and sets `Retry-After` plus `X-RateLimit-*` headers.

### Prompt safety middleware

Prism applies a lightweight prompt safety check (heuristics for jailbreak / prompt injection and clearly harmful requests).

This runs **after authentication and rate limiting** and rejects unsafe prompts with `400`.

Env:

- `PROMPT_SAFETY_ENABLED` (default `true`) — set to `false` to disable.

### Redis response caching (chat completions)

Prism caches successful `/v1/chat/completions` JSON responses in Redis so repeated prompts can return instantly.

- Cache key: SHA-256 of `model + messages` (normalized) so the same prompt+model maps to the same key.
- Response header: `X-Cache: HIT|MISS`
 - Response header: `X-Cache: HIT|MISS|BYPASS`

Env:

- `AI_CACHE_ENABLED` (default `true`)
- `AI_CACHE_TTL_SECONDS` (default `600`)
- `AI_CACHE_PREFIX` (default `prism:chatcache`)

Notes:

- Requires the same Upstash env used by rate limiting: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Streaming requests (`stream: true`) are not cached.
 - Streaming requests (`stream: true`) are not cached.

## Scripts

- `npm start` — runs `src/server.js`
- `npm dev` — runs the server with nodemon
- `npm test` — placeholder
