// Everzio JWT authentication and authorization middleware
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const jwtOptions = { issuer: 'everzio-api', audience: 'everzio-web' };

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET, jwtOptions);
    if (!decoded.id || decoded.type !== 'access') throw new Error('Invalid access token');
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ success: false, message: 'User not found.' });
    if (!req.user.isActive) return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    next();
  } catch (_) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token. Please log in again.' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Access denied.' });
  next();
};

const optionalAuth = async (req, res, next) => {
  const token = getBearerToken(req);
  req.user = null;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, jwtOptions);
    if (decoded.type === 'access') req.user = await User.findById(decoded.id).select('-password');
  } catch (_) {
    req.user = null;
  }
  next();
};

module.exports = { protect, adminOnly, optionalAuth };
