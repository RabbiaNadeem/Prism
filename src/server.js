'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;

function createApp() {
  const app = express();

  app.use(pinoHttp());
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get('/', (req, res) => {
    res.status(200).send('Prism server running');
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

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
