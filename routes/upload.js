// Everzio secure product image upload
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { protect, adminOnly } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads/products');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.memoryStorage();
const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);

const fileFilter = (req, file, cb) => {
  if (!allowedMime.has(file.mimetype)) return cb(new Error('Only JPG, PNG and WEBP images are allowed.'));
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 10, parts: 20 },
});

const detectImageType = (buffer) => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.readUInt32BE(0) === 0x89504e47 && buffer.readUInt32BE(4) === 0x0d0a1a0a) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
};

router.post('/', protect, adminOnly, upload.array('images', 5), async (req, res) => {
  const written = [];
  try {
    if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files uploaded.' });

    for (const file of req.files) {
      const detected = detectImageType(file.buffer);
      if (!detected || (detected === 'jpg' && file.mimetype !== 'image/jpeg') || detected !== ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.mimetype])) {
        return res.status(400).json({ success: false, message: 'Invalid image content detected.' });
      }
      const filename = `product_${crypto.randomUUID()}.${detected}`;
      const target = path.join(uploadDir, filename);
      await fs.promises.writeFile(target, file.buffer, { flag: 'wx', mode: 0o640 });
      written.push(filename);
    }

    const urls = written.map((filename) => `/uploads/products/${filename}`);
    res.status(201).json({ success: true, message: `${urls.length} image(s) uploaded.`, urls });
  } catch (err) {
    await Promise.all(written.map((name) => fs.promises.unlink(path.join(uploadDir, name)).catch(() => {})));
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'Image exceeds 5MB limit.' });
    if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ success: false, message: 'Maximum 5 images per upload.' });
    console.error('Upload error:', err);
    res.status(400).json({ success: false, message: err.message || 'Upload failed.' });
  }
});

router.delete('/', protect, adminOnly, async (req, res) => {
  try {
    const raw = String(req.body.filename || '');
    const filename = path.basename(raw);
    if (!filename || filename !== raw || !/^product_[a-f0-9-]+\.(jpg|png|webp)$/.test(filename)) {
      return res.status(400).json({ success: false, message: 'Invalid filename.' });
    }
    const target = path.join(uploadDir, filename);
    await fs.promises.unlink(target);
    res.json({ success: true, message: 'Image deleted.' });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ success: false, message: 'File not found.' });
    console.error('Delete upload error:', err);
    res.status(500).json({ success: false, message: 'Unable to delete image.' });
  }
});

module.exports = router;
