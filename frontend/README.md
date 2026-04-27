# Prism Frontend

Luxury, modern React UI for Prism with a graphite/platinum visual system and a performance-first chat playground.

## Stack

- React + Vite (JavaScript)
- Native CSS design tokens
- Lazy-loaded non-critical sections for smaller initial payload

## Run

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Environment

Create `frontend/.env`:

```bash
VITE_API_BASE_URL=http://localhost:3000
```

If unset, the app defaults to `http://localhost:3000`.

## Features

- Premium graphite/platinum UI with accessible contrast
- Clear top navigation and sectioned landing flow
- Prism chat playground with API key input and model selection
- Error-state handling for auth/rate-limit/safety failures
- Metadata display for `X-Cache`, rate-limit values, and retry headers
- Memoized message list and lazy section loading for performance
