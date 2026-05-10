# Prism

Prism is an OpenAI-compatible AI API gateway built with Node.js and Express.  
It routes chat completions across **Groq** and **Gemini** with automatic failover, adds API-key auth, rate limiting, optional response caching, and prompt safety checks.

## What It Does

- Exposes `POST /v1/chat/completions` in OpenAI-style request/response shape
- Validates client API keys (`Authorization: Bearer ...` or `x-api-key`)
- Enforces per-key rate limiting via Upstash Redis (sliding window)
- **Auto-routing:** omit `model` or send `"model": "auto"` to try Groq models first, then Gemini (same four catalog IDs), picking the first upstream that succeeds
- Optional `provider` hint in the JSON body restricts failover to a single provider name (e.g. `groq`, `gemini`) when you need it for debugging
- Optionally returns an echo fallback when all providers fail (`PRISM_ECHO_FALLBACK=true`)
- Lists configured upstream catalog at `GET /providers/models` (no secrets)
- Successful completions may include **`X-Prism-Provider`** and **`X-Prism-Model`** response headers (also exposed to browsers via CORS for the playground)
- Supports OpenAPI docs at `/api-docs` and raw spec at `/openapi.json`

## Tech Stack

- Node.js (CommonJS)
- Express 5
- Upstash Redis (`@upstash/redis`)
- Swagger (`swagger-jsdoc`, `swagger-ui-express`)
- Security/logging: `helmet`, `cors`, `pino-http`

## Project Structure

```text
src/
  server.js                 # App bootstrap and middleware wiring
  swagger.js                # OpenAPI spec generation
  routes/
    ai.routes.js            # /v1/chat/completions route
  services/
    ai.service.js           # Service facade
    llmRouter.js            # Provider routing, normalization, failover
    modelCatalog.js         # Groq/Gemini model metadata for /providers/models
  middleware/
    auth.js                 # API key auth
    rateLimiter.js          # Redis sliding-window limiter
    aiCache.js              # Optional response cache (Redis)
    promptSafety.js         # Prompt safety heuristics
    errorHandler.js         # Central error handler
frontend/                   # React + Vite playground UI (Dockerfile included)
```

## Requirements

- Node.js 20+ (recommended)
- npm
- Upstash Redis credentials (required for rate limiting)
- At least one provider API key (Groq or Gemini)

## Environment Variables

Create a `.env` file in the project root (see `.env.example`).

### Server

- `PORT` (default: `3000`)

### Client Authentication (required)

Use one of the following to allow client calls into Prism:

- `ALLOWED_API_KEY` (single key, or comma/newline separated)
- `ALLOWED_API_KEYS` (allow list)
- Backward compatible: `PRISM_API_KEYS` or `PRISM_API_KEY`

### Rate Limiting (required in current implementation)

- `UPSTASH_REDIS_REST_URL` (required)
- `UPSTASH_REDIS_REST_TOKEN` (required)
- `RATE_LIMIT_WINDOW_MS` (default: `60000`)
- `RATE_LIMIT_MAX` (default: `60`)
- `RATE_LIMIT_PREFIX` (default: `prism:ratelimit`)

### AI Providers (configure at least one)

- `GROQ_API_KEY` — one key covers all Groq models in the catalog (optional: comma/newline list or `GROQ_API_KEYS` for ordered failover across keys)
- `GROQ_BASE_URL` (default: `https://api.groq.com/openai/v1`)

- `GEMINI_API_KEY` — one key covers all Gemini models in the catalog (optional: comma/newline list or `GEMINI_API_KEYS` for ordered failover across keys)
- `GEMINI_BASE_URL` (default: `https://generativelanguage.googleapis.com/v1beta/openai`)
- `GEMINI_AUTH_MODE` (default: `x-goog-api-key`; also supports `bearer` and `api-key`)

- `LLM_PROVIDER_TIMEOUT_MS` (default: `15000`)
- `PRISM_ECHO_FALLBACK` (`true`/`false`, default: `false`)

### Optional Features

- `AI_CACHE_ENABLED` (`true`/`false`, default: `true`, requires Upstash to be effective)
- `AI_CACHE_TTL_SECONDS` (default: `600`)
- `AI_CACHE_PREFIX` (default: `prism:chatcache`)
- `PROMPT_SAFETY_ENABLED` (`true`/`false`, default: `true`)

### Debugging upstream failures (optional)

- `PRISM_EXPOSE_UPSTREAM_ERRORS` — when set to `true`, include sanitized `details` (per-provider HTTP status, requested model) on "all providers failed" responses even if `NODE_ENV=production`. Without it, `details` are only added when `NODE_ENV` is not `production`.

## Local Development

Install and run:

```bash
npm install
npm run dev
```

Production start:

```bash
npm start
```

## API Endpoints

- `GET /` -> basic service status text
- `GET /health` -> `{ "ok": true }`
- `GET /openapi.json` -> OpenAPI JSON
- `GET /api-docs` -> Swagger UI
- `GET /providers/models` -> `{ "providers": [...] }` (configured providers only; public)
- `POST /v1/chat/completions` -> main AI gateway endpoint (auth required)

### Auto model routing

Send `"model": "auto"` (or omit `model`; Prism defaults it). Prism tries, in order:

1. `llama-3.1-8b-instant` (Groq)
2. `llama-3.3-70b-versatile` (Groq)
3. `gemini-2.5-flash` (Gemini)
4. `gemini-2.5-pro` (Gemini)

Successful responses include **`X-Prism-Provider`** and **`X-Prism-Model`** so clients can show which upstream answered.


## Docker

### API only

```bash
docker build -t prism .
docker run --rm -p 3000:3000 --env-file .env prism
```

### API + frontend (recommended)

From the repo root:

```bash
cp .env.example .env   # then edit: ALLOWED_API_KEY, Redis, GROQ/GEMINI keys
docker compose up --build
```

- UI: [http://localhost:8080](http://localhost:8080)
- API: [http://localhost:3000](http://localhost:3000)

The frontend image is built with `VITE_API_BASE_URL=http://localhost:3000` so the **browser** calls the API on your machine. If your API is on another origin, rebuild the frontend with a different base URL (see comments in `docker-compose.yml`).

## CI/CD (GitHub Actions)

Workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes and pull requests to **`main`** / **`master`**:

1. **Backend** — `npm ci`, `npm test`, and a bootstrap check that loads `createApp()` with **placeholder Upstash env vars** (only so the rate limiter can construct; no Redis traffic occurs).
2. **Frontend** — `npm ci` + `npm run build` in `frontend/`.
3. **Docker** — builds the API image (`Dockerfile`) and the UI image (`frontend/Dockerfile`) to verify images still compile.

For integration tests that hit `/v1`, use real **`UPSTASH_REDIS_REST_URL`** / **`UPSTASH_REDIS_REST_TOKEN`** via [encrypted secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions).

## Troubleshooting: "All LLM providers failed"

That error means Prism reached your app, but **every** configured upstream attempt returned an error. Check the following.

1. **Confirm the browser points at Prism**  
   The frontend uses `VITE_API_BASE_URL` (default `http://localhost:3000`). Only one process can bind to a port.  
   Quick check: open `GET http://localhost:3000/health` — Prism returns `{"ok":true}`.

2. **Confirm provider keys load in the same process as Prism**  
   `GROQ_API_KEY` / `GEMINI_API_KEY` must exist in the environment of the **Node** server. For Docker: ensure `.env` exists next to `docker-compose.yml` (Compose passes it into `api`). Recreate containers after changing `.env`.

3. **Read logs**  
   Structured logs include `LLM provider failed (trying next)` with `provider`, `model`, and `status` when an upstream returns a non-2xx status or times out.

4. **Auto mode tries multiple models**  
   With `model: auto`, Prism cycles through the four catalog models until one succeeds. If you pin a specific `model`, every provider attempt uses that id until failover exhausts options.

**Dev-only JSON details:** When `NODE_ENV` is not `production`, error responses for upstream exhaustion can include `details` (`attempts`, `modelRequested`, `hint`). In production, set `PRISM_EXPOSE_UPSTREAM_ERRORS=true` to include the same structured `details` field (no API key material).

## Notes

- Streaming (`stream: true`) is currently rejected on `/v1/chat/completions`.
- If no provider is configured, the API returns an error.
- The current `test` script is a placeholder (`No tests specified`).

## Observability

Prism exposes Prometheus-style metrics at `GET /metrics` (public endpoint).

High-level metrics include:

- `prism_requests_total` (route/method/status request volume)
- `prism_request_duration_ms` (latency histogram)
- `prism_errors_total` (error volume by route/status/kind)
- `prism_cache_events_total` (HIT/MISS/BYPASS for cache hit-rate tracking)
- `prism_rate_limit_total` (allowed vs throttled outcomes)
- `prism_provider_requests_total` (provider success/failure by provider name)
- `prism_token_estimated_input_total` and `prism_token_estimated_output_total`
- `prism_uptime_seconds`

Token accounting behavior:

- Uses provider-reported usage when available (`completion_tokens`).
- Falls back to a lightweight estimator for input/output tokens.
- Values are meant for trend observability and capacity planning, not billing precision.

Logging is structured with pino and sensitive headers are redacted (`authorization`, `x-api-key`, `x-admin-secret`).

## Frontend (React + Vite)

A playground UI lives in `frontend/`.

```bash
cd frontend
npm install
npm run dev
```

Point it at the API:

```bash
VITE_API_BASE_URL=http://localhost:3000
```

The playground stores your Prism client key in **localStorage** so you do not have to paste it on every refresh (clear with **Clear saved key** in the UI).

See `frontend/README.md` for build details.
