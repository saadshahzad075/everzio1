// ══════════════════════════════════════════════════
// routes/orders.js — Orders + Email Notifications
// ══════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const nodemailer = require('nodemailer');

// ── Email Transporter ────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,  // Gmail App Password
    },
  });
}

// ── Beautiful HTML Email Template ───────────────────
function buildOrderEmail(order) {
  const itemsHTML = order.items.map(item => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #f0f0f0;">
        <div style="font-weight:600;color:#0d1a18;">${item.name}</div>
        <div style="font-size:12px;color:#888;">Qty: ${item.qty}</div>
      </td>
      <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#2a7a6a;">
        Rs. ${(item.price * item.qty).toLocaleString()}
      </td>
    </tr>`).join('');

  const payBadge = {
    cod: '💵 Cash on Delivery',
    jazzcash: '📱 JazzCash',
    easypaisa: '💚 Easypaisa',
    stripe: '💳 Card Payment',
  }[order.payment.method] || order.payment.method;

  const waMsg = encodeURIComponent(
    `Assalamu Alaikum! Order #${order.shortId} ki update chahiye.\nNaam: ${order.shipping.name}\nPhone: ${order.shipping.phone}`
  );

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#0d1a18,#1a3d37,#2a7a6a);padding:32px 32px 24px;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">🛒</div>
    <h1 style="color:white;margin:0;font-size:26px;letter-spacing:3px;">EVERZIO</h1>
    <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px;">Pakistan's Premium Store</p>
  </td></tr>

  <!-- Success Banner -->
  <tr><td style="background:linear-gradient(135deg,#10b981,#059669);padding:16px 32px;text-align:center;">
    <div style="color:white;font-size:18px;font-weight:700;">🎉 NAYA ORDER AAYA!</div>
    <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px;">Order #${order.shortId} — ${new Date(order.createdAt).toLocaleString('en-PK')}</div>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:28px 32px;">

    <!-- Customer Info -->
    <div style="background:#f8fffe;border:1px solid rgba(42,122,106,0.15);border-radius:10px;padding:20px;margin-bottom:20px;">
      <h3 style="margin:0 0 14px;color:#2a7a6a;font-size:14px;text-transform:uppercase;letter-spacing:1px;">👤 Customer Details</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:5px 0;color:#555;font-size:13px;width:120px;">Name:</td>
          <td style="padding:5px 0;font-weight:700;color:#0d1a18;font-size:13px;">${order.shipping.name}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#555;font-size:13px;">Phone:</td>
          <td style="padding:5px 0;font-weight:700;color:#0d1a18;font-size:13px;">
            <a href="tel:${order.shipping.phone}" style="color:#2a7a6a;text-decoration:none;">${order.shipping.phone}</a>
            ${order.shipping.phone2 ? ` / <a href="tel:${order.shipping.phone2}" style="color:#2a7a6a;text-decoration:none;">${order.shipping.phone2}</a>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#555;font-size:13px;">City:</td>
          <td style="padding:5px 0;font-weight:700;color:#0d1a18;font-size:13px;">${order.shipping.city}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#555;font-size:13px;">Address:</td>
          <td style="padding:5px 0;font-weight:600;color:#0d1a18;font-size:13px;">${order.shipping.address}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#555;font-size:13px;">Payment:</td>
          <td style="padding:5px 0;font-weight:700;color:#0d1a18;font-size:13px;">${payBadge}</td>
        </tr>
        ${order.payment.transactionId ? `<tr><td style="padding:5px 0;color:#555;font-size:13px;">TXN ID:</td><td style="padding:5px 0;font-weight:700;color:#2a7a6a;font-size:13px;">${order.payment.transactionId}</td></tr>` : ''}
      </table>
    </div>

    <!-- Order Items -->
    <div style="background:#f8fffe;border:1px solid rgba(42,122,106,0.15);border-radius:10px;padding:20px;margin-bottom:20px;">
      <h3 style="margin:0 0 14px;color:#2a7a6a;font-size:14px;text-transform:uppercase;letter-spacing:1px;">📦 Order Items</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${itemsHTML}
        <tr>
          <td style="padding:8px 10px;color:#555;font-size:13px;">Delivery Charges</td>
          <td style="padding:8px 10px;text-align:right;color:#555;font-size:13px;">Rs. ${order.deliveryCharges.toLocaleString()}</td>
        </tr>
        <tr style="background:linear-gradient(135deg,rgba(42,122,106,0.08),rgba(78,205,196,0.08));">
          <td style="padding:12px 10px;font-weight:800;font-size:16px;color:#0d1a18;">TOTAL</td>
          <td style="padding:12px 10px;text-align:right;font-weight:800;font-size:18px;color:#2a7a6a;">Rs. ${order.total.toLocaleString()}</td>
        </tr>
      </table>
    </div>

    <!-- Quick Actions -->
    <div style="text-align:center;margin-bottom:20px;">
      <a href="https://wa.me/923437583849?text=${waMsg}"
        style="display:inline-block;background:#25D366;color:white;padding:14px 28px;border-radius:25px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:1px;margin:0 6px 10px;">
        💬 WhatsApp Reply
      </a>
      <a href="tel:${order.shipping.phone}"
        style="display:inline-block;background:#2a7a6a;color:white;padding:14px 28px;border-radius:25px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:1px;margin:0 6px 10px;">
        📞 Call Customer
      </a>
    </div>

    <!-- Status Info -->
    <div style="background:#fff8e1;border:1px solid #ffd54f;border-radius:8px;padding:14px;text-align:center;">
      <div style="font-size:13px;color:#f57f17;font-weight:600;">⚡ Jaldi confirm karein — Customer intezaar mein hai!</div>
    </div>

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#0d1a18;padding:20px 32px;text-align:center;">
    <div style="color:rgba(255,255,255,0.5);font-size:12px;">
      © 2025 Everzio | 📞 03437583849 | 🌐 everzio.pk
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Send Email ───────────────────────────────────────
async function sendOrderEmail(order) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('⚠️  Email not configured — skipping email notification');
    return;
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Everzio Store" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,  // Send to yourself
      subject: `🛒 Naya Order! #${order.shortId} — Rs. ${order.total.toLocaleString()} — ${order.shipping.name}`,
      html: buildOrderEmail(order),
    });
    console.log(`✅ Order email sent for #${order.shortId}`);
  } catch (err) {
    console.error('❌ Email send failed:', err.message);
    // Don't throw — order should still succeed even if email fails
  }
}

// ── POST /api/order ──────────────────────────────────
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { shipping, items, payment, subtotal, deliveryCharges = 150 } = req.body;

    if (!shipping || !items || !payment || !subtotal) {
      return res.status(400).json({ success: false, message: 'shipping, items, payment, subtotal zaroori hain.' });
    }
    if (!shipping.name || !shipping.phone || !shipping.address || !shipping.city) {
      return res.status(400).json({ success: false, message: 'Naam, phone, address, city zaroori hain.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart empty hai.' });
    }

    const total = subtotal + deliveryCharges;

    const order = await Order.create({
      userId: req.user ? req.user._id : null,
      shipping,
      items,
      subtotal,
      deliveryCharges,
      total,
      payment: {
        method: payment.method,
        status: 'pending',
        transactionId: payment.transactionId || '',
      },
      status: 'pending',
    });

    // Clear DB cart for logged-in user
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { cart: [] });
    }

    // Send email notification (async — don't await so order response is fast)
    sendOrderEmail(order);

    res.status(201).json({
      success: true,
      message: 'Order place ho gaya! 🎉',
      order,
      orderId: order._id,
      shortId: order.shortId,
    });
  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ success: false, message: 'Server error. Dobara try karein.' });
  }
});

// ── GET /api/orders ──────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let filter = {};

    if (req.user.role === 'admin') {
      if (status && status !== 'all') filter.status = status;
    } else {
      filter.userId = req.user._id;
      if (status && status !== 'all') filter.status = status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).populate('userId', 'name email phone'),
      Order.countDocuments(filter),
    ]);

    res.json({ success: true, total, page: parseInt(page), orders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/orders/:id ──────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('userId', 'name email phone');
    if (!order) return res.status(404).json({ success: false, message: 'Order nahi mila.' });
    if (req.user.role !== 'admin' && order.userId && order.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/orders/:id/status ───────────────────────
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['pending','confirmed','processing','shipped','delivered','cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order nahi mila.' });
    res.json({ success: true, message: `Status: ${status}`, order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/orders/:id ───────────────────────────
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order nahi mila.' });
    res.json({ success: true, message: 'Order delete ho gaya.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/orders/stats/summary ───────────────────
router.get('/stats/summary', protect, adminOnly, async (req, res) => {
  try {
    const [totalOrders, revenue, pending, delivered] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'delivered' }),
    ]);
    res.json({ success: true, stats: { totalOrders, totalRevenue: revenue[0]?.total || 0, pendingOrders: pending, deliveredOrders: delivered } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
