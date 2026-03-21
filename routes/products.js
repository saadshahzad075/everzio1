// ══════════════════════════════════════════════════
// routes/products.js — Product CRUD + Search
// ══════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');

// ── GET /api/products ────────────────────────────────
// Get all active products (public)
// Query params: category, search, sort, page, limit
router.get('/', async (req, res) => {
  try {
    const { category, search, sort = '-createdAt', page = 1, limit = 50 } = req.query;

    // Build filter
    const filter = { isActive: true };

    if (category && category !== 'all') {
      filter.category = category.toLowerCase();
    }

    // Text search across name + description
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { category: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Parse sort option
    const sortMap = {
      '-createdAt': { createdAt: -1 },
      'price-asc': { price: 1 },
      'price-desc': { price: -1 },
      'rating': { rating: -1 },
      'popular': { reviews: -1 },
    };
    const sortObj = sortMap[sort] || { createdAt: -1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortObj).skip(skip).limit(parseInt(limit)),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      products,
    });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/products/:id ────────────────────────────
// Get single product (public)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/products ───────────────────────────────
// Create product (Admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, description, price, oldPrice, images, category, badge, rating, reviews, stock, videoUrl } =
      req.body;

    if (!name || !description || !price || !images || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, price, images, and category are required.',
      });
    }

    const product = await Product.create({
      name,
      description,
      price,
      oldPrice: oldPrice || null,
      images: Array.isArray(images) ? images : [images],
      category,
      badge: badge || '',
      rating: rating || 0,
      reviews: reviews || 0,
      videoUrl: videoUrl || '',
      stock: stock || 100,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, message: 'Product created!', product });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/products/:id ────────────────────────────
// Update product (Admin only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    res.json({ success: true, message: 'Product updated!', product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/products/:id ─────────────────────────
// Soft delete product (Admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
