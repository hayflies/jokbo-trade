const swaggerJsdoc = require('swagger-jsdoc');

const protocol = process.env.APP_PROTOCOL || 'http';
const hostFromEnv = process.env.APP_HOST || process.env.PUBLIC_HOST || process.env.HOST;
const host = hostFromEnv && hostFromEnv !== '0.0.0.0' ? hostFromEnv : 'localhost';
const port = parseInt(process.env.PORT, 10) || 3203;
const baseUrl = process.env.APP_BASE_URL || `${protocol}://${host}${port ? `:${port}` : ''}`;

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
        url: baseUrl,
        description: 'Primary server'
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
