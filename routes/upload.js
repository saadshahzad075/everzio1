const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { protect, adminOnly } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads/products');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `product_${crypto.randomUUID()}${ext}`);
  },
});

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const fileFilter = (_req, file, cb) => {
  if (!allowedMime.has(file.mimetype) || !allowedExt.has(path.extname(file.originalname).toLowerCase())) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'images'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 20, parts: 25 },
});

const hasValidSignature = (filePath, mimetype) => {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);
    if (mimetype === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    if (mimetype === 'image/png') return header.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if (mimetype === 'image/webp') return header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP';
    return false;
  } finally {
    fs.closeSync(fd);
  }
};

router.post('/', protect, adminOnly, (req, res, next) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err) return next(err);
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'No files uploaded.' });
      }

      const invalid = req.files.filter(file => !hasValidSignature(file.path, file.mimetype));
      if (invalid.length) {
        for (const file of req.files) {
          try { fs.unlinkSync(file.path); } catch (_) {}
        }
        return res.status(400).json({ success: false, message: 'One or more files are not valid images.' });
      }

      const urls = req.files.map(file => `/uploads/products/${file.filename}`);
      return res.status(201).json({ success: true, message: `${urls.length} image(s) uploaded.`, urls });
    } catch (error) {
      return next(error);
    }
  });
});

router.delete('/', protect, adminOnly, (req, res, next) => {
  try {
    const raw = String(req.body.filename || '');
    const filename = path.basename(raw);
    if (!filename || filename !== raw || !/^product_[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) {
      return res.status(400).json({ success: false, message: 'Invalid filename.' });
    }
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File not found.' });
    fs.unlinkSync(filePath);
    return res.json({ success: true, message: 'Image deleted.' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
