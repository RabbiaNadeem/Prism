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

## Notes

- Streaming (`stream: true`) is currently rejected on `/v1/chat/completions`.
- If no provider is configured, the API returns an error.
- The current `test` script is a placeholder (`No tests specified`).

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
