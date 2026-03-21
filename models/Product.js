// ══════════════════════════════════════════════════
// models/Product.js — Product Schema
// ══════════════════════════════════════════════════

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name too long'],
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    oldPrice: {
      type: Number,
      default: null,
      min: [0, 'Old price cannot be negative'],
    },
    // Array of image URLs (Unsplash, Cloudinary, etc.)
    images: {
      type: [String],
      required: [true, 'At least one image is required'],
      validate: {
        validator: (arr) => arr.length >= 1,
        message: 'At least one image URL is required',
      },
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['electronics', 'fashion', 'home', 'beauty', 'sports', 'food', 'toys', 'other'],
      lowercase: true,
    },
    badge: {
      type: String,
      enum: ['', 'SALE', 'NEW', 'HOT'],
      default: '',
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviews: {
      type: Number,
      default: 0,
    },
    stock: {
      type: Number,
      default: 100,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // YouTube video URL (optional)
    videoUrl: {
      type: String,
      default: '',
    },
    // Track who created this product (admin)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast search
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });

// Virtual: discount percentage
productSchema.virtual('discountPct').get(function () {
  if (!this.oldPrice || this.oldPrice <= this.price) return 0;
  return Math.round((1 - this.price / this.oldPrice) * 100);
});

productSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
