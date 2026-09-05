// Everzio authentication routes
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

const signAccessToken = (id) => jwt.sign(
  { id: id.toString(), type: 'access' },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '2h', issuer: 'everzio-api', audience: 'everzio-web' }
);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const safeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
});

const validatePassword = (password) => typeof password === 'string' && password.length >= 8 && password.length <= 128;

router.post('/register', authLimiter, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    const phone = String(req.body.phone || '').trim();

    if (name.length < 2 || name.length > 50 || !email || !validatePassword(password)) {
      return res.status(400).json({ success: false, message: 'Valid name, email and password (8–128 characters) are required.' });
    }

    const existingUser = await User.findOne({ email }).select('_id');
    if (existingUser) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });

    const user = await User.create({ name, email, password, phone });
    res.status(201).json({ success: true, message: 'Account created successfully!', token: signAccessToken(user._id), user: safeUser(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    if (!email || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    res.json({ success: true, message: 'Logged in successfully!', token: signAccessToken(user._id), user: safeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist', 'name price images');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/profile', protect, async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body.phone !== undefined) updates.phone = String(req.body.phone).trim();
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ success: true, message: 'Profile updated.', user: safeUser(user) });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(400).json({ success: false, message: 'Unable to update profile.' });
  }
});

module.exports = router;
