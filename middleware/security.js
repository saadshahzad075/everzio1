const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const requestId = (req, res, next) => {
  const incoming = req.get('X-Request-ID');
  const id = incoming && /^[A-Za-z0-9._-]{8,100}$/.test(incoming)
    ? incoming
    : crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
});

module.exports = { requestId, apiLimiter, authLimiter };
