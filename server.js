// Everzio — production-hardened Express backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const { corsOptions, apiLimiter, requestId } = require('./middleware/security');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

app.use(requestId);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
app.use(cors(corsOptions));
app.use('/api', apiLimiter);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '1mb' }));

// Product images are intentionally public, but upload/write access is protected by the upload route.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  index: false,
  dotfiles: 'deny',
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
}));
app.use(express.static(path.join(__dirname, '../frontend')));

// Connect before serving application traffic.
connectDB();

app.use('/api', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/order', require('./routes/orders'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'everzio-api',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

app.get('/api/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    status: ready ? 'ready' : 'not_ready',
    database: mongoose.connection.readyState,
    requestId: req.requestId,
  });
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  } else {
    res.status(404).json({ success: false, message: 'API route not found.', requestId: req.requestId });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error', { requestId: req.requestId, name: err.name, message: err.message });
  const status = Number(err.status || err.statusCode) || 500;
  const safeMessage = status >= 500 ? 'Internal server error.' : err.message;
  res.status(status).json({ success: false, message: safeMessage, requestId: req.requestId });
});

const server = app.listen(PORT, () => {
  console.log(`Everzio API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

const shutdown = async (signal) => {
  console.log(`${signal} received; shutting down gracefully...`);
  server.close(async () => {
    try {
      await mongoose.connection.close(false);
    } finally {
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
