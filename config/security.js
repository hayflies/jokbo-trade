const helmet = require('helmet');

function buildHelmetConfig({ isSecure = false } = {}) {
  const defaultDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();

  if (!isSecure) {
    delete defaultDirectives['upgrade-insecure-requests'];
  }

  const directives = {
    ...defaultDirectives,
    "style-src": ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    "font-src": ["'self'", 'https://fonts.gstatic.com', 'data:'],
    "script-src": ["'self'", "'unsafe-inline'"],
    "connect-src": ["'self'", 'ws:', 'wss:'],
    "img-src": ["'self'", 'data:', 'blob:'],
    "form-action": ["'self'"],
    "frame-ancestors": ["'self'"],
    "object-src": ["'none'"]
  };

  if (!isSecure) {
    delete directives['upgrade-insecure-requests'];
  }

  const config = {
    contentSecurityPolicy: {
      useDefaults: false,
      directives
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    originAgentCluster: true,
    hsts: false,
    referrerPolicy: { policy: 'no-referrer' }
  };

  if (!isSecure) {
    config.crossOriginOpenerPolicy = false;
  }

  return config;
}

module.exports = { buildHelmetConfig };

