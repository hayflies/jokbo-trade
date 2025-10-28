const helmet = require('helmet');

function buildHelmetConfig() {
  const directives = {
    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
    "style-src": ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    "font-src": ["'self'", 'https://fonts.gstatic.com', 'data:'],
    "script-src": ["'self'", "'unsafe-inline'"],
    "connect-src": ["'self'", 'ws:', 'wss:'],
    "img-src": ["'self'", 'data:', 'blob:'],
    "form-action": ["'self'"],
    "frame-ancestors": ["'self'"],
    "object-src": ["'none'"]
  };

  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: false,
    referrerPolicy: { policy: 'no-referrer' }
  };
}

module.exports = { buildHelmetConfig };

