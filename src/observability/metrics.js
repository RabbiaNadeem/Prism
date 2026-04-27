'use strict';

const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'prism_process_' });

const requestsTotal = new client.Counter({
  name: 'prism_requests_total',
  help: 'Total HTTP requests processed by Prism',
  labelNames: ['route', 'method', 'status'],
  registers: [register],
});

const requestDurationMs = new client.Histogram({
  name: 'prism_request_duration_ms',
  help: 'HTTP request latency in milliseconds',
  labelNames: ['route', 'method', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [register],
});

const errorsTotal = new client.Counter({
  name: 'prism_errors_total',
  help: 'Total handled errors by status and kind',
  labelNames: ['route', 'status', 'kind'],
  registers: [register],
});

const cacheEventsTotal = new client.Counter({
  name: 'prism_cache_events_total',
  help: 'Cache outcomes for AI responses',
  labelNames: ['status'],
  registers: [register],
});

const rateLimitEventsTotal = new client.Counter({
  name: 'prism_rate_limit_total',
  help: 'Rate limiter outcomes',
  labelNames: ['outcome'],
  registers: [register],
});

const providerRequestsTotal = new client.Counter({
  name: 'prism_provider_requests_total',
  help: 'Provider-level request outcomes',
  labelNames: ['provider', 'outcome'],
  registers: [register],
});

const tokenEstimatedInputTotal = new client.Counter({
  name: 'prism_token_estimated_input_total',
  help: 'Estimated input tokens across chat requests',
  labelNames: ['model'],
  registers: [register],
});

const tokenEstimatedOutputTotal = new client.Counter({
  name: 'prism_token_estimated_output_total',
  help: 'Estimated output tokens across chat responses',
  labelNames: ['model'],
  registers: [register],
});

const uptimeGauge = new client.Gauge({
  name: 'prism_uptime_seconds',
  help: 'Process uptime in seconds',
  registers: [register],
});

setInterval(() => {
  uptimeGauge.set(process.uptime());
}, 5000).unref();
uptimeGauge.set(process.uptime());

function observeRequest({ route, method, status, durationMs }) {
  const labels = { route, method, status: String(status) };
  requestsTotal.inc(labels);
  requestDurationMs.observe(labels, durationMs);
}

function recordError({ route, status, kind }) {
  errorsTotal.inc({
    route,
    status: String(status),
    kind: kind || 'unknown',
  });
}

function recordCache(status) {
  cacheEventsTotal.inc({ status: status || 'UNKNOWN' });
}

function recordRateLimit(outcome) {
  rateLimitEventsTotal.inc({ outcome: outcome || 'unknown' });
}

function recordProvider(provider, outcome) {
  providerRequestsTotal.inc({
    provider: provider || 'unknown',
    outcome: outcome || 'unknown',
  });
}

function recordInputTokens(model, total) {
  tokenEstimatedInputTotal.inc({
    model: model || 'unknown',
  }, Math.max(0, Number(total) || 0));
}

function recordOutputTokens(model, total) {
  tokenEstimatedOutputTotal.inc({
    model: model || 'unknown',
  }, Math.max(0, Number(total) || 0));
}

module.exports = {
  register,
  observeRequest,
  recordError,
  recordCache,
  recordRateLimit,
  recordProvider,
  recordInputTokens,
  recordOutputTokens,
};
