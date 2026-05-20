import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';

import { uploadToR2 } from '../lib/r2.js';
import { sanitizeName } from '../utils/sanitize.js';
import { jobs, createJob, deleteJobAfterDelay } from '../lib/jobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Multer config for video
const upload = multer({
  dest: path.join(__dirname, '../../tmp'),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
});

// ─── FFmpeg Frame Extraction ─────────────────────────────────────────────────

function extractFrames(videoPath, tmpDir, fps) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([`-vf fps=${fps}`])
      .output(path.join(tmpDir, 'frame_%05d.jpg'))
      .on('end', () => {
        console.log('FFmpeg extraction complete');
        resolve();
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err.message);
        reject(new Error(`FFmpeg failed: ${err.message}`));
      })
      .run();
  });
}

// ─── Background Video Processing ─────────────────────────────────────────────

async function processVideo(jobId, videoPath, videoName, fps) {
  const sanitizedVideoName = sanitizeName(path.parse(videoName).name);
  const tmpDir = path.join(__dirname, '../../tmp', `frames_${jobId}`);

  try {
    // Create temp directory for frames
    fs.mkdirSync(tmpDir, { recursive: true });

    // Step 1 — Extract frames with FFmpeg
    jobs[jobId].status = 'extracting';
    console.log(`Job ${jobId}: Extracting frames at ${fps} FPS...`);
    await extractFrames(videoPath, tmpDir, fps);

    // Step 2 — Read extracted frame files
    const frameFiles = fs.readdirSync(tmpDir)
      .filter(f => f.endsWith('.jpg'))
      .sort();

    jobs[jobId].total = frameFiles.length;
    jobs[jobId].status = 'uploading';
    console.log(`Job ${jobId}: Uploading ${frameFiles.length} frames (no compression)...`);

    // Step 3 — Upload each frame without compression
    for (let i = 0; i < frameFiles.length; i++) {
      const frameFile = frameFiles[i];
      const framePath = path.join(tmpDir, frameFile);
      const frameNumber = i + 1;

      try {
        // Read raw frame buffer — no compression
        const rawBuffer = fs.readFileSync(framePath);

        const key = `frames/${sanitizedVideoName}/frame_${String(frameNumber).padStart(5, '0')}.jpg`;
        const url = await uploadToR2(rawBuffer, key);

        jobs[jobId].results.push({
          url,
          fileName: key,
          frameNumber,
          videoName,
          sizeKB: Math.round(rawBuffer.length / 1024),
        });

        jobs[jobId].progress = frameNumber;

        console.log(`Uploaded frame ${frameNumber}: ${Math.round(rawBuffer.length / 1024)}KB (uncompressed)`);

        // Delete frame file from disk after upload
        fs.unlinkSync(framePath);

      } catch (err) {
        console.error(`Job ${jobId}: Failed frame ${frameNumber}:`, err.message);
      }
    }

    jobs[jobId].status = 'complete';
    console.log(`Job ${jobId}: Complete! ${jobs[jobId].results.length} frames uploaded`);

  } catch (err) {
    jobs[jobId].status = 'error';
    jobs[jobId].error = err.message;
    console.error(`Job ${jobId} failed:`, err.message);

  } finally {
    // Cleanup temp files
    try { fs.unlinkSync(videoPath); } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

    // Delete job from memory after 30 minutes
    deleteJobAfterDelay(jobId);
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/upload/video
router.post('/upload/video', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No video file uploaded' });
  }

  const fps = parseFloat(req.body.fps) || 1;
  const videoName = req.body.videoName || req.file.originalname;
  const jobId = uuidv4();

  // Create job in memory
  createJob(jobId, videoName, fps);

  // Respond immediately with jobId
  res.json({ jobId });

  // Start processing in background (no await)
  processVideo(jobId, req.file.path, videoName, fps);
});

// GET /api/job/:jobId
router.get('/job/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    status: job.status,
    progress: job.progress,
    total: job.total,
    resultCount: job.results.length,
    results: job.status === 'complete' ? job.results : [],
    error: job.error,
  });
});

export default router;