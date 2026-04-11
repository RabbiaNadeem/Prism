'use strict';

const path = require('node:path');
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Prism API',
      version: '1.0.0',
    },
    tags: [{ name: 'System' }, { name: 'AI' }],
    servers: [{ url: 'http://localhost:3000' }],
  },
  apis: [path.join(__dirname, 'routes', '*.js'), path.join(__dirname, 'server.js')],
});

module.exports = { swaggerSpec };
