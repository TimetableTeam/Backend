const express = require('express');
const cors = require('cors');
const { env } = require('./src/config/env');
const routes = require('./src/routes');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

const allowedOrigins = env.FRONTEND_URL.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Debug middleware
app.use((req, res, next) => {
  console.log('[APP] Request:', req.method, req.url, 'Body:', req.body);
  next();
});

app.use('/api/v1', routes);

app.use((req, res, next) => {
  console.log('[APP] Not found:', req.method, req.url);
  notFoundHandler(req, res);
});

app.use((err, req, res, next) => {
  console.error('[APP] Error:', err);
  errorHandler(err, req, res, next);
});

app.listen(5001, () => {
  console.log('Test server on port 5001');
});