const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Jokbo Trade API',
      version: '1.0.0',
      description: 'API documentation for the anonymous academic material auction platform.'
    },
    servers: [
      {
        url: 'http://localhost:' + (process.env.PORT || 3000),
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid'
        }
      }
    },
    security: [{ cookieAuth: [] }]
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
