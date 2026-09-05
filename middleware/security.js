const rateLimit = require('express-rate-limit');

const isProduction = process.env.NODE_ENV === 'production';

const getAllowedOrigins = () => {
  const raw = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
};

const allowedOrigins = getAllowedOrigins();

const corsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key'],
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!isProduction && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 300),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 10),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

const requestId = (req, res, next) => {
  const incoming = req.get('X-Request-ID');
  const id = incoming && /^[A-Za-z0-9._:-]{8,100}$/.test(incoming)
    ? incoming
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};

module.exports = { corsOptions, apiLimiter, authLimiter, requestId };
