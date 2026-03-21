// ══════════════════════════════════════════════════
// models/Order.js — Order Schema
// ══════════════════════════════════════════════════

const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.Mixed },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, default: '' },
  qty: { type: Number, required: true, min: 1 },
});

const orderSchema = new mongoose.Schema(
  {
    // Customer info — either logged-in user or guest
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = guest checkout
    },

    // Shipping details
    shipping: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      phone2: { type: String, default: '' },
      address: { type: String, required: true },
      city: { type: String, required: true },
    },

    // Order items
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length >= 1,
        message: 'Order must have at least one item',
      },
    },

    // Pricing
    subtotal: { type: Number, required: true },
    deliveryCharges: { type: Number, default: 150 },
    total: { type: Number, required: true },

    // Payment
    payment: {
      method: {
        type: String,
        enum: ['cod', 'jazzcash', 'easypaisa', 'stripe', 'bank'],
        required: true,
      },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },
      transactionId: { type: String, default: '' },
      // Stripe payment intent ID (for card payments)
      stripePaymentIntentId: { type: String, default: '' },
    },

    // Order lifecycle status
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },

    // Admin notes
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

// Index for fast queries
orderSchema.index({ userId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

// Virtual: short order ID for display
orderSchema.virtual('shortId').get(function () {
  return this._id.toString().slice(-8).toUpperCase();
});

orderSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);
