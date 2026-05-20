import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

import { compressImage } from '../lib/compress.js';
import { uploadToR2 } from '../lib/r2.js';
import { sanitizeName } from '../utils/sanitize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Multer config
const upload = multer({
  dest: path.join(__dirname, '../../tmp'),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
});

router.post('/upload/images', upload.array('images', 100), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files uploaded' });
  }

  const results = [];
  const errors = [];

  for (const file of req.files) {
    try {
      // Read uploaded file into buffer
      const inputBuffer = fs.readFileSync(file.path);

      // Compress the image
      const compressedBuffer = await compressImage(inputBuffer);

      // Build R2 storage key
      const originalNameNoExt = path.parse(file.originalname).name;
      const sanitized = sanitizeName(originalNameNoExt);
      const uuid = uuidv4();
      const key = `images/${uuid}_${sanitized}.jpg`;

      // Upload to R2
      const url = await uploadToR2(compressedBuffer, key);

      results.push({
        url,
        fileName: key,
        originalName: file.originalname,
        sizeKB: Math.round(compressedBuffer.length / 1024),
      });

      console.log(`Uploaded: ${key} (${Math.round(compressedBuffer.length / 1024)}KB)`);

    } catch (err) {
      console.error(`Failed to process ${file.originalname}:`, err.message);
      errors.push({
        originalName: file.originalname,
        error: err.message,
      });
    } finally {
      // Always delete temp file
      try {
        fs.unlinkSync(file.path);
      } catch {}
    }
  }

  res.json({
    success: true,
    results,
    errors,
    total: req.files.length,
  });
});

export default router;