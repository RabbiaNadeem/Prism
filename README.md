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

## Scripts

- `npm start` — runs `src/server.js`
- `npm dev` — runs the server with nodemon
- `npm test` — placeholder
