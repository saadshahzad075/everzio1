// Everzio Express Backend — production security baseline
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/db');
const { requestId, apiLimiter } = require('./middleware/security');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  if (isProduction) throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  console.warn('WARNING: JWT_SECRET is missing/weak. Configure a strong secret before production.');
}
if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is required.');
}

connectDB();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(requestId);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',').map(v => v.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use('/api', apiLimiter);

// Uploaded files should never be executable application code.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  index: false,
  dotfiles: 'deny',
  maxAge: isProduction ? '7d' : 0,
}));
app.use(express.static(path.join(__dirname, '../frontend'), { index: 'index.html' }));

app.use('/api', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/order', require('./routes/orders'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, status: 'ok', timestamp: new Date().toISOString(), requestId: req.requestId });
});

app.get('/api/ready', (req, res) => {
  const mongoose = require('mongoose');
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ success: ready, status: ready ? 'ready' : 'not_ready', requestId: req.requestId });
});

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found.', requestId: req.requestId });
  }
  return res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use((err, req, res, next) => {
  console.error(`[${req.requestId}] Unhandled error:`, err);
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error.' : err.message,
    requestId: req.requestId,
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Everzio API listening on port ${PORT}`));

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    try {
      const mongoose = require('mongoose');
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
