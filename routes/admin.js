// ══════════════════════════════════════════════════
// routes/admin.js — Admin-specific routes
// ══════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// ── GET /api/admin/dashboard ─────────────────────────
// Full dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalOrders,
      revenueData,
      totalUsers,
      totalProducts,
      pendingOrders,
      recentOrders,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      User.countDocuments({ role: 'user' }),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments({ status: 'pending' }),
      Order.find().sort({ createdAt: -1 }).limit(10).populate('userId', 'name email'),
    ]);

    res.json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue: revenueData[0]?.total || 0,
        totalUsers,
        totalProducts,
        pendingOrders,
      },
      recentOrders,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/admin/users ─────────────────────────────
// List all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(),
    ]);

    res.json({ success: true, total, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/admin/users/:id ──────────────────────
// Deactivate user account
router.delete('/users/:id', async (req, res) => {
  try {
    // Don't allow self-deletion
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }

    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'User deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/admin/seed ─────────────────────────────
// Seed initial products from the original Everzio data
router.post('/seed', async (req, res) => {
  try {
    const existing = await Product.countDocuments();
    if (existing > 0) {
      return res.json({ success: false, message: `Already have ${existing} products. Skipping seed.` });
    }

    const seedProducts = [
      { name: "Samsung Galaxy A15 - 6GB/128GB", price: 42999, oldPrice: 52000, images: ["https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&q=80","https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&q=80"], category: "electronics", rating: 4.5, reviews: 234, badge: "SALE", description: "6.5 inch Super AMOLED display, 50MP camera, 5000mAh battery. 1 saal ki warranty ke saath. Dual SIM, 4G enabled.", stock: 50 },
      { name: "Wireless Bluetooth Earbuds Pro", price: 2499, oldPrice: 4500, images: ["https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80","https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80"], category: "electronics", rating: 4.2, reviews: 156, badge: "HOT", description: "30 ghante battery life, active noise cancellation, waterproof IPX5. Sports ke liye perfect.", stock: 200 },
      { name: "Men's Casual Shalwar Kameez", price: 1850, oldPrice: 2800, images: ["https://images.unsplash.com/photo-1617137968427-85924c800a22?w=600&q=80","https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&q=80"], category: "fashion", rating: 4.7, reviews: 89, badge: "NEW", description: "Premium cotton fabric, machine washable, S se 3XL tak available. Aaram aur style ka perfect combo.", stock: 150 },
      { name: "Ladies Embroidered Lawn Suit 3-Piece", price: 3200, oldPrice: 5000, images: ["https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&q=80","https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=600&q=80"], category: "fashion", rating: 4.8, reviews: 312, badge: "SALE", description: "Beautiful embroidery, soft lawn fabric, unstitched. All sizes available.", stock: 80 },
      { name: "Non-Stick Cooking Pan Set (5-Piece)", price: 2999, oldPrice: 4200, images: ["https://images.unsplash.com/photo-1584831494823-76e56be6ebc4?w=600&q=80","https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80"], category: "home", rating: 4.4, reviews: 201, badge: "SALE", description: "Granite coating, induction compatible, dishwasher safe. Professional quality ke saath healthy khana.", stock: 60 },
      { name: "Smart LED Bulb 9W (Pack of 4)", price: 899, oldPrice: 1400, images: ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80","https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=600&q=80"], category: "home", rating: 4.3, reviews: 445, badge: "", description: "Energy saving, 2 saal warranty, cool white & warm white options. 9W = 85W traditional bulb.", stock: 500 },
      { name: "Vitamin C Face Serum 30ml", price: 1299, oldPrice: 2000, images: ["https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80","https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&q=80"], category: "beauty", rating: 4.6, reviews: 678, badge: "HOT", description: "Brightening serum, dark spots kam kare, dermatologist tested, suitable for all skin types.", stock: 120 },
      { name: "Kids Football Official Size 5", price: 1499, oldPrice: 2200, images: ["https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=600&q=80","https://images.unsplash.com/photo-1508098682722-e99c643e7f0b?w=600&q=80"], category: "sports", rating: 4.5, reviews: 123, badge: "", description: "Durable PU material, machine stitched, comes with pump. Perfect for outdoor play.", stock: 75 },
      { name: "Basmati Rice 5kg - Super Kernel", price: 1150, oldPrice: 1400, images: ["https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=600&q=80","https://images.unsplash.com/photo-1560472355-536de3962603?w=600&q=80"], category: "food", rating: 4.9, reviews: 892, badge: "HOT", description: "Premium quality super kernel basmati, long grain, extra aroma. Fresh stock, direct from farms.", stock: 200 },
      { name: "RC Racing Car with Remote Control", price: 3499, oldPrice: 5000, images: ["https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=600&q=80","https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=600&q=80"], category: "toys", rating: 4.4, reviews: 167, badge: "NEW", description: "High speed 30km/h, 2.4GHz remote, rechargeable battery, for age 6+.", stock: 40 },
      { name: "Laptop Bag 15.6\" Waterproof", price: 1899, oldPrice: 2800, images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80","https://images.unsplash.com/photo-1491637639811-60e2756cc1c7?w=600&q=80"], category: "electronics", rating: 4.3, reviews: 234, badge: "", description: "Multiple compartments, USB charging port, anti-theft pocket, comfortable shoulder strap.", stock: 90 },
      { name: "Air Fryer 3.5L Digital", price: 8999, oldPrice: 13000, images: ["https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&q=80","https://images.unsplash.com/photo-1574270981993-a0e1b8ee8aef?w=600&q=80"], category: "home", rating: 4.7, reviews: 445, badge: "SALE", description: "Oil-free cooking, 8 preset programs, easy to clean, 1500W. Healthy khana ghar mein.", stock: 30 },
      { name: "Women's Sports Shoes", price: 2799, oldPrice: 4500, images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80","https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=600&q=80"], category: "fashion", rating: 4.5, reviews: 321, badge: "NEW", description: "Breathable mesh, cushioned sole, sizes 36-42. Running aur gym ke liye best.", stock: 100 },
      { name: "Hair Dryer 2000W Professional", price: 3499, oldPrice: 5500, images: ["https://images.unsplash.com/photo-1522338140262-f46f5913618a?w=600&q=80","https://images.unsplash.com/photo-1500840216050-6ffa99d75160?w=600&q=80"], category: "beauty", rating: 4.4, reviews: 289, badge: "SALE", description: "Ionic technology, 3 heat settings, cool shot button, frizz free glossy hair.", stock: 55 },
      { name: "Dumbbell Set 10kg Adjustable", price: 4500, oldPrice: 6000, images: ["https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80","https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=600&q=80"], category: "sports", rating: 4.6, reviews: 178, badge: "", description: "Anti-rust coating, comfortable grip, home gym ke liye ideal. Weight adjustable.", stock: 45 },
      { name: "Desi Ghee 1kg Pure Buffalo", price: 2200, oldPrice: 2800, images: ["https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&q=80","https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80"], category: "food", rating: 4.8, reviews: 567, badge: "HOT", description: "100% pure buffalo ghee, traditional method se bana, natural aroma. No additives.", stock: 80 },
    ];

    await Product.insertMany(seedProducts.map(p => ({ ...p, createdBy: req.user._id })));

    res.json({ success: true, message: `✅ Seeded ${seedProducts.length} products!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Seed error: ' + err.message });
  }
});

module.exports = router;
