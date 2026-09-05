const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET, {
  issuer: 'everzio-api',
  audience: 'everzio-web',
});

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
};

const protect = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Access denied. Please log in.' });

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid authentication session.' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token. Please log in again.' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  next();
};

const optionalAuth = async (req, res, next) => {
  const token = getBearerToken(req);
  req.user = null;
  if (!token) return next();
  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select('-password');
    if (user && user.isActive) req.user = user;
  } catch (_) {
    // Invalid optional credentials are treated as anonymous.
  }
  next();
};

module.exports = { protect, adminOnly, optionalAuth };
