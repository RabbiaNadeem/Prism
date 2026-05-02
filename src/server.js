'use strict';

require('dotenv').config();
const crypto = require('node:crypto');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const pino = require('pino');

const swaggerUi = require('swagger-ui-express');

const { swaggerSpec } = require('./swagger');
const { aiRouter } = require('./routes/ai.routes');
const { errorHandler } = require('./middleware/errorHandler');
const { auth } = require('./middleware/auth');
const { createRateLimiter } = require('./middleware/rateLimiter');
const { requestMetrics } = require('./middleware/requestMetrics');
const { register } = require('./observability/metrics');
const { getAvailableProviders } = require('./services/modelCatalog');

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const appLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.x-api-key',
      'req.headers.x-admin-secret',
      'headers.authorization',
      'headers.x-api-key',
      'headers.x-admin-secret',
    ],
    remove: true,
  },
});

function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Middleware order matters:
  // 1) request logging
  // 2) security + CORS
  // 3) route-specific middleware (rate limit + auth)
  // 4) body parsing
  app.use(
    pinoHttp({
      logger: appLogger,
      genReqId: (req, res) => req.headers['x-request-id'] || res.getHeader('x-request-id') || crypto.randomUUID(),
      customProps: (req, res) => ({
        route: req.route?.path || req.path,
        statusCode: res.statusCode,
      }),
    }),
  );
  app.use(requestMetrics);
  app.use(helmet());
  app.use(cors());

  // API documentation
  app.get('/openapi.json', (req, res) => {
    res.status(200).json(swaggerSpec);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  /**
   * @openapi
   * /health:
   *   get:
   *     tags:
   *       - System
   *     summary: Health check
   *     responses:
   *       200:
   *         description: OK
   */
  app.get('/health', (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get('/metrics', async (req, res, next) => {
    try {
      res.set('Content-Type', register.contentType);
      const output = await register.metrics();
      res.status(200).send(output);
    } catch (err) {
      next(err);
    }
  });

  app.get('/', (req, res) => {
    res.status(200).send('Prism server running');
  });

  /**
   * @openapi
   * /providers/models:
   *   get:
   *     tags:
   *       - System
   *     summary: List configured providers and their models
   *     description: Returns provider/model metadata only for providers whose API keys are configured. Public; no secrets are exposed.
   *     responses:
   *       200:
   *         description: Provider catalog
   */
  app.get('/providers/models', (req, res) => {
    res.status(200).json({ providers: getAvailableProviders(process.env) });
  });

  // API routes (protected)
  app.use(
    '/v1',
    auth,
    createRateLimiter(),
    express.json({ limit: '1mb' }),
    express.urlencoded({ extended: false }),
    aiRouter,
  );

  // 404 handler (must be after routes)
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

function start() {
  const app = createApp();
  const server = app.listen(PORT, () => {
    appLogger.info({ port: PORT }, 'Prism server listening');
  });
  return server;
}

if (require.main === module) {
  start();
}

module.exports = { createApp, start };
