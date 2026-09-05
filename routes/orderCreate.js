const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { optionalAuth } = require('../middleware/auth');

const FREE_DELIVERY_THRESHOLD = Number(process.env.FREE_DELIVERY_THRESHOLD || 2000);
const STANDARD_DELIVERY = Number(process.env.STANDARD_DELIVERY || 150);

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

router.post('/', optionalAuth, async (req, res) => {
  const idempotencyKey = clean(req.get('Idempotency-Key'), 100);
  if (!idempotencyKey) return res.status(400).json({ success: false, message: 'Idempotency-Key is required.' });

  try {
    const existing = await Order.findOne({ idempotencyKey });
    if (existing) return res.status(200).json({ success: true, message: 'Order already created.', order: existing, orderId: existing._id, shortId: existing.shortId, idempotent: true });

    const { shipping, items, payment } = req.body;
    if (!shipping || !Array.isArray(items) || !items.length || !payment?.method) {
      return res.status(400).json({ success: false, message: 'Shipping, items and payment method are required.' });
    }
    if (items.length > 100) return res.status(400).json({ success: false, message: 'Too many cart items.' });

    const shippingData = {
      name: clean(shipping.name, 100), phone: clean(shipping.phone, 30), phone2: clean(shipping.phone2, 30),
      address: clean(shipping.address, 500), city: clean(shipping.city, 100),
    };
    if (!shippingData.name || !shippingData.phone || !shippingData.address || !shippingData.city) {
      return res.status(400).json({ success: false, message: 'Name, phone, address and city are required.' });
    }

    const normalized = new Map();
    for (const item of items) {
      if (!mongoose.isValidObjectId(item.productId)) return res.status(400).json({ success: false, message: 'Invalid product.' });
      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > 1000) return res.status(400).json({ success: false, message: 'Invalid quantity.' });
      const key = String(item.productId);
      normalized.set(key, (normalized.get(key) || 0) + qty);
    }

    const ids = [...normalized.keys()];
    const products = await Product.find({ _id: { $in: ids }, isActive: true }).select('name price images stock').lean();
    const byId = new Map(products.map(p => [String(p._id), p]));
    if (products.length !== ids.length) return res.status(409).json({ success: false, message: 'One or more products are unavailable.' });

    const orderItems = [];
    let subtotal = 0;
    for (const [id, qty] of normalized) {
      const p = byId.get(id);
      if (p.stock < qty) return res.status(409).json({ success: false, message: `${p.name} is out of stock.` });
      const line = p.price * qty;
      subtotal += line;
      orderItems.push({ productId: p._id, name: p.name, price: p.price, image: p.images?.[0] || '', qty });
    }

    const deliveryCharges = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY;
    const total = subtotal + deliveryCharges;
    const paymentMethod = String(payment.method).toLowerCase();
    if (!['cod', 'jazzcash', 'easypaisa', 'stripe', 'bank'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Unsupported payment method.' });
    }

    // Reserve stock atomically. If any reservation fails, restore previous reservations.
    const reserved = [];
    try {
      for (const [id, qty] of normalized) {
        const updated = await Product.findOneAndUpdate(
          { _id: id, isActive: true, stock: { $gte: qty } },
          { $inc: { stock: -qty } },
          { new: true }
        );
        if (!updated) throw Object.assign(new Error('Stock changed. Please retry.'), { status: 409 });
        reserved.push({ id, qty });
      }

      const order = await Order.create({
        userId: req.user?._id || null,
        shipping: shippingData,
        items: orderItems,
        subtotal,
        deliveryCharges,
        total,
        payment: {
          method: paymentMethod,
          status: 'pending',
          // Manual transaction references are evidence only; never mark paid from client input.
          transactionId: clean(payment.transactionId, 200),
        },
        status: 'pending',
        idempotencyKey,
      });

      if (req.user) await User.findByIdAndUpdate(req.user._id, { $set: { cart: [] } });
      return res.status(201).json({ success: true, message: 'Order placed successfully.', order, orderId: order._id, shortId: order.shortId });
    } catch (err) {
      await Promise.allSettled(reserved.map(({ id, qty }) => Product.updateOne({ _id: id }, { $inc: { stock: qty } })));
      if (err?.code === 11000) {
        const duplicate = await Order.findOne({ idempotencyKey });
        if (duplicate) return res.status(200).json({ success: true, message: 'Order already created.', order: duplicate, orderId: duplicate._id, shortId: duplicate.shortId, idempotent: true });
      }
      const status = err.status || 500;
      return res.status(status).json({ success: false, message: status === 500 ? 'Unable to create order.' : err.message });
    }
  } catch (err) {
    console.error('Authoritative checkout error:', err);
    return res.status(500).json({ success: false, message: 'Unable to create order.' });
  }
});

module.exports = router;
