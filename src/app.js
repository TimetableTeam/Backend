'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');

const {
  securityHeaders,
  apiLimiter,
  authLimiter,
  passwordResetLimiter
} = require('./middleware/security');

const routes = require('./routes');

const {
  errorHandler,
  notFoundHandler
} = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const allowedOrigins = [
    'https://tanseek-time-table.vercel.app',
    'http://localhost:5173'
  ];

  const corsOptions = {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token'
    ]
  };

  app.use(cors(corsOptions));

  app.options('*', cors(corsOptions));

  app.use(securityHeaders);

  app.use(apiLimiter);

  app.use(express.json({ limit: '1mb' }));

  app.use(express.urlencoded({ extended: true }));

  app.use(
    '/docs',
    express.static(
      path.join(__dirname, '../node_modules/swagger-editor-dist')
    )
  );

  app.get('/docs', (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        '../node_modules/swagger-editor-dist/index.html'
      )
    );
  });

  app.use('/api/v1/auth/login', authLimiter);

  app.use('/api/v1/auth/forgot-password', authLimiter);

  app.use('/api/v1/auth/reset-password', authLimiter);

  app.use('/api/v1/auth/verify-otp', authLimiter);

  app.use('/api/v1/auth/verify-reset-token', authLimiter);

  app.use('/api/v1/auth/forgot-password', passwordResetLimiter);

  app.use('/api/v1/auth/reset-password', passwordResetLimiter);

  app.use('/api/v1', routes);

  app.use(notFoundHandler);

  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp
};