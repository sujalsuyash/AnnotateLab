import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import healthRouter from './src/routes/health.js';
import imagesRouter from './src/routes/images.js';
import videoRouter from './src/routes/video.js';
import deleteRouter from './src/routes/delete.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: '*'
}));
app.use(express.json());

// Skip ngrok browser warning
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// Create tmp directory if it doesn't exist
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
  console.log('Created tmp directory');
}

// Routes
app.use('/api', healthRouter);
app.use('/api', imagesRouter);
app.use('/api', videoRouter);
app.use('/api', deleteRouter);

// Start server
app.listen(PORT, () => {
  console.log('----------------------------------------');
  console.log(`AnnotateLab Backend running on port ${PORT}`);
  console.log(`Cloudinary Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);
  console.log('----------------------------------------');
});