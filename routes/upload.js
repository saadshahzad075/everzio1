// ══════════════════════════════════════════════════
// routes/upload.js — Image Upload Route
// ══════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, adminOnly } = require('../middleware/auth');

// ── Create uploads folder if not exists ─────────────
const uploadDir = path.join(__dirname, '../uploads/products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Multer Storage Config ────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Unique filename: timestamp + random + original extension
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `product_${Date.now()}_${Math.round(Math.random() * 1000)}${ext}`;
    cb(null, uniqueName);
  },
});

// ── File Filter — only images ────────────────────────
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const isValid =
    allowedTypes.test(path.extname(file.originalname).toLowerCase()) &&
    allowedTypes.test(file.mimetype);

  if (isValid) cb(null, true);
  else cb(new Error('Only image files allowed (jpg, png, gif, webp)'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
});

// ── POST /api/upload — Upload up to 5 images ────────
router.post('/', protect, adminOnly, upload.array('images', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded.' });
    }

    // Return public URLs for each uploaded file
    const urls = req.files.map(
      (file) => `/uploads/products/${file.filename}`
    );

    res.json({
      success: true,
      message: `${urls.length} image(s) uploaded!`,
      urls,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/upload — Delete an image ────────────
router.delete('/', protect, adminOnly, (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ success: false, message: 'filename required.' });

    const filePath = path.join(uploadDir, path.basename(filename));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'Image deleted.' });
    } else {
      res.status(404).json({ success: false, message: 'File not found.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
