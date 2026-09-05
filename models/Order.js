const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  image: { type: String, default: '' },
  qty: { type: Number, required: true, min: 1, max: 1000 },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  shipping: {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    phone2: { type: String, default: '', trim: true, maxlength: 30 },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
  },
  items: { type: [orderItemSchema], required: true, validate: arr => arr.length >= 1 },
  subtotal: { type: Number, required: true, min: 0 },
  deliveryCharges: { type: Number, default: 150, min: 0 },
  total: { type: Number, required: true, min: 0 },
  payment: {
    method: { type: String, enum: ['cod', 'jazzcash', 'easypaisa', 'stripe', 'bank'], required: true },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    transactionId: { type: String, default: '', trim: true, maxlength: 200 },
    stripePaymentIntentId: { type: String, default: '', trim: true, maxlength: 200 },
  },
  status: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  notes: { type: String, default: '', maxlength: 2000 },
  idempotencyKey: { type: String, unique: true, sparse: true, index: true, maxlength: 100 },
}, { timestamps: true });

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.virtual('shortId').get(function () { return this._id.toString().slice(-8).toUpperCase(); });
orderSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);
