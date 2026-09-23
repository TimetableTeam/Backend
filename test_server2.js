const express = require('express');
const cors = require('cors');
const { env } = require('../config/env');
const routes = require('../routes');
const { errorHandler, notFoundHandler } = require('../middleware/errorHandler');

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
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`[startup] Tanseek backend listening on port ${env.PORT} (${env.NODE_ENV})`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});