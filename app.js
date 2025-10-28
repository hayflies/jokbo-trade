require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const http = require('http');
const https = require('https');
const fs = require('fs');

const { initMaria } = require('./db/mariadb');
const { initMongo } = require('./db/mongo');
const { configureSocket } = require('./services/socketService');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { ensureAdmin } = require('./middleware/auth');

const authRoutes = require('./routes/authRoutes');
const auctionRoutes = require('./routes/auctionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiRoutes = require('./routes/apiRoutes');
const adminApiRoutes = require('./routes/adminApiRoutes');

const { buildHelmetConfig } = require('./config/security');

const requestedProtocol = (process.env.APP_PROTOCOL || 'http').toLowerCase();
const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT, 10) || 3203;

function resolvePath(maybePath) {
  if (!maybePath) {
    return undefined;
  }
  const trimmed = maybePath.trim();
  if (!trimmed) {
    return undefined;
  }
  return path.isAbsolute(trimmed) ? trimmed : path.join(process.cwd(), trimmed);
}

function buildHttpsOptions() {
  const keyPath = resolvePath(process.env.SSL_KEY_PATH);
  const certPath = resolvePath(process.env.SSL_CERT_PATH);

  if (!keyPath || !certPath) {
    return null;
  }

  try {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };

    const caPath = resolvePath(process.env.SSL_CA_PATH);
    if (caPath) {
      httpsOptions.ca = fs.readFileSync(caPath);
    }

    if (process.env.SSL_PASSPHRASE) {
      httpsOptions.passphrase = process.env.SSL_PASSPHRASE;
    }

    return httpsOptions;
  } catch (error) {
    console.error('Failed to load SSL certificates', error);
    return null;
  }
}

const app = express();

let activeProtocol = requestedProtocol === 'https' ? 'https' : 'http';
let server;

if (requestedProtocol === 'https') {
  const httpsOptions = buildHttpsOptions();
  if (httpsOptions) {
    server = https.createServer(httpsOptions, app);
  } else {
    console.warn(
      'APP_PROTOCOL is set to https but SSL configuration is missing. Falling back to http server.'
    );
    activeProtocol = 'http';
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

configureSocket(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const helmetOptions = buildHelmetConfig();
app.use(helmet(helmetOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

const sessionSecret = process.env.SESSION_SECRET || '63f4945d921d599f27ae4fdf5bada3f1';
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/202010832';

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoUri }),
    cookie: { maxAge: 1000 * 60 * 60 * 2 }
  })
);

app.use(flash());
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.flash();
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', authRoutes);
app.use('/auctions', auctionRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/api', adminApiRoutes);
app.use('/api', apiRoutes);
app.use('/api-docs', ensureAdmin, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
  res.redirect('/auctions');
});

app.use((err, req, res, next) => {
  console.error(err);
  if (req.xhr || req.originalUrl.startsWith('/api')) {
    return res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
  }
  res.status(err.status || 500).render('error', { error: err });
});

const appHostPreference = process.env.APP_HOST || process.env.PUBLIC_HOST || process.env.HOST;
const displayHost = appHostPreference && appHostPreference !== '0.0.0.0' ? appHostPreference : 'localhost';
const isStandardPort = (port, protocol) => (protocol === 'https' ? port === 443 : port === 80);
const portSuffix = PORT && !isStandardPort(PORT, activeProtocol) ? `:${PORT}` : '';
const appBaseUrl = process.env.APP_BASE_URL || `${activeProtocol}://${displayHost}${portSuffix}`;

async function start() {
  await initMaria();
  await initMongo();
  server.listen(PORT, HOST, () => {
    console.log(`Server listening on ${appBaseUrl} (bound to ${HOST})`);
  });
}

start().catch((error) => {
  console.error('Failed to start application', error);
  process.exit(1);
});

module.exports = app;
