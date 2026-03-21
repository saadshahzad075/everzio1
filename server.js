// ══════════════════════════════════════════════════
// server.js — Everzio Express Backend
// ══════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

// ── Connect to MongoDB ───────────────────────────────
connectDB();

// ── CORS — allow frontend to talk to backend ─────────
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:5500',   // Live Server (VS Code)
      'http://127.0.0.1:5500',
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Body Parsers ─────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Serve Uploaded Images Publicly ───────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Serve static frontend files ──────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API Routes ───────────────────────────────────────
app.use('/api', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/order', require('./routes/orders'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));  // Image Upload

// ── Health Check ─────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Everzio API is running! 🚀',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── Serve frontend for all non-API routes ─────────────
// (SPA-style fallback)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  } else {
    res.status(404).json({ success: false, message: 'API route not found.' });
  }
});

// ── Global Error Handler ─────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

// ── Start Server ─────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║       EVERZIO BACKEND RUNNING         ║');
  console.log('╠═══════════════════════════════════════╣');
  console.log(`║  API:      http://localhost:${PORT}/api   ║`);
  console.log(`║  Health:   http://localhost:${PORT}/api/health ║`);
  console.log(`║  Mode:     ${process.env.NODE_ENV || 'development'}                  ║`);
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
