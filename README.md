# Prism

Prism is an OpenAI-compatible AI API gateway built with Node.js and Express.  
It routes chat completion requests across multiple providers (Groq, Gemini, OpenRouter), adds API-key auth, rate limiting, optional response caching, and prompt safety checks.

## What It Does

- Exposes `POST /v1/chat/completions` in OpenAI-style request/response shape
- Validates client API keys (`Authorization: Bearer ...` or `x-api-key`)
- Enforces per-key rate limiting via Upstash Redis (sliding window)
- Tries providers in order and fails over if one provider errors
- Optionally returns an echo fallback when all providers fail
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
  middleware/
    auth.js                 # API key auth
    rateLimiter.js          # Redis sliding-window limiter
    aiCache.js              # Optional response cache (Redis)
    promptSafety.js         # Prompt safety heuristics
    errorHandler.js         # Central error handler
```

## Requirements

- Node.js 20+ (recommended)
- npm
- Upstash Redis credentials (required for rate limiting)
- At least one provider API key (Groq, Gemini, or OpenRouter)

## Environment Variables

Create a `.env` file in the project root.

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

- `GROQ_API_KEY`
- `GROQ_BASE_URL` (default: `https://api.groq.com/openai/v1`)

- `GEMINI_API_KEY`
- `GEMINI_BASE_URL` (default: `https://generativelanguage.googleapis.com/v1beta/openai`)
- `GEMINI_AUTH_MODE` (default: `x-goog-api-key`; also supports `bearer` and `api-key`)

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL` (default: `https://openrouter.ai/api/v1`)
- `OPENROUTER_HTTP_REFERER` (optional)
- `OPENROUTER_X_TITLE` (optional)

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
- `POST /v1/chat/completions` -> main AI gateway endpoint (auth required)

## Request Example

Use `body.json` as a base payload:

```json
{
  "messages": [
    { "role": "user", "content": "hi" }
  ]
}
```

Call the endpoint:

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ALLOWED_API_KEY" \
  -d @body.json
```

## Docker

Build and run:

```bash
docker build -t prism .
docker run --rm -p 3000:3000 --env-file .env prism
```

## Troubleshooting: "All LLM providers failed"

That error means Prism reached your app, but **every** configured upstream (Groq, then Gemini, then OpenRouter) returned an error. Check the following.

1. **Confirm the browser points at Prism**  
   The frontend uses `VITE_API_BASE_URL` (default `http://localhost:3000`). Only one process can bind to a port. For example, if `php -S localhost:3000` is running, Node/Prism cannot use `3000`; stop the other server or run Prism on another port and set `VITE_API_BASE_URL` accordingly.  
   Quick check: open `GET http://localhost:3000/health` — Prism returns `{"ok":true}`.

2. **Confirm provider keys load in the same process as Prism**  
   `GROQ_API_KEY` / `GEMINI_API_KEY` must exist in the environment of the **Node** server. For Docker: use `--env-file .env` or `-e` and recreate the container after changing `.env`. For `npm start`, use a project `.env` loaded at startup.

3. **Read logs**  
   Structured logs include `LLM provider failed (trying next)` with `provider` and `status` when an upstream returns a non-2xx status or times out.

4. **Failover uses one `model` for every provider**  
   Providers run in order until one succeeds. Each attempt uses the **same** `model` from the client. A Groq-specific id (e.g. `llama-3.1-8b-instant`) may be invalid for Gemini if Groq fails and Prism falls through—use a model id valid for the provider you expect to answer, or adjust keys so the right provider is tried first.

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

A modern graphite/platinum frontend is available in `frontend/`.

```bash
cd frontend
npm install
npm run dev
```

Set frontend API target with:

```bash
VITE_API_BASE_URL=http://localhost:3000
```

See `frontend/README.md` for full UI details and production build instructions.
