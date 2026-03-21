// ══════════════════════════════════════════════════
// routes/cart.js — Cart Management (DB-backed)
// ══════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

// All cart routes require authentication
router.use(protect);

// ── GET /api/cart ────────────────────────────────────
// Get current user's cart
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, cart: user.cart });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/cart ───────────────────────────────────
// Add item to cart or update qty
router.post('/', async (req, res) => {
  try {
    const { productId, qty = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required.' });
    }

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const user = await User.findById(req.user._id);

    // Check if item already in cart
    const existingItem = user.cart.find(
      (item) => item.productId.toString() === productId.toString()
    );

    if (existingItem) {
      existingItem.qty += qty;
    } else {
      user.cart.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        image: product.images[0],
        qty,
      });
    }

    await user.save();
    res.json({ success: true, message: 'Added to cart!', cart: user.cart });
  } catch (err) {
    console.error('Cart add error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/cart/:productId ─────────────────────────
// Update item quantity
router.put('/:productId', async (req, res) => {
  try {
    const { qty } = req.body;
    const user = await User.findById(req.user._id);

    const item = user.cart.find(
      (i) => i.productId.toString() === req.params.productId
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not in cart.' });
    }

    if (qty <= 0) {
      // Remove item
      user.cart = user.cart.filter(
        (i) => i.productId.toString() !== req.params.productId
      );
    } else {
      item.qty = qty;
    }

    await user.save();
    res.json({ success: true, cart: user.cart });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/cart/:productId ──────────────────────
// Remove item from cart
router.delete('/:productId', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.cart = user.cart.filter(
      (i) => i.productId.toString() !== req.params.productId
    );
    await user.save();
    res.json({ success: true, message: 'Item removed.', cart: user.cart });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/cart ─────────────────────────────────
// Clear entire cart
router.delete('/', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { cart: [] });
    res.json({ success: true, message: 'Cart cleared.', cart: [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
