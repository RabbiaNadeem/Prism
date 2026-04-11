'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');

const swaggerUi = require('swagger-ui-express');

const { swaggerSpec } = require('./swagger');
const { aiRouter } = require('./routes/ai.routes');
const { errorHandler } = require('./middleware/errorHandler');

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;

function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Middleware order matters:
  // 1) request logging
  // 2) security + CORS
  // 3) body parsing
  app.use(pinoHttp());
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

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

  app.get('/', (req, res) => {
    res.status(200).send('Prism server running');
  });

  // API routes
  app.use(aiRouter);

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
    // eslint-disable-next-line no-console
    console.log(`Prism listening on http://localhost:${PORT}`);
  });
  return server;
}

if (require.main === module) {
  start();
}

module.exports = { createApp, start };
