'use strict';

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Prism API',
    version: '1.0.0',
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: {
          200: { description: 'OK' },
        },
      },
    },
  },
};

module.exports = { swaggerSpec };
