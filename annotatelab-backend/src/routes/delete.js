import express from 'express';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();

router.delete('/delete', async (req, res) => {
  const { fileName } = req.body;

  if (!fileName) {
    return res.status(400).json({ success: false, error: 'fileName is required' });
  }

  try {
    // Convert fileName to Cloudinary public_id
    // fileName looks like: images/uuid_name.jpg or frames/videoname/frame_00001.jpg
    // Cloudinary public_id looks like: annotatelab/images_uuid_name or annotatelab/frames_videoname_frame_00001
    const publicId = 'annotatelab/' + fileName
      .replace(/\//g, '_')
      .replace(/\.jpg$/, '')

    console.log(`Deleting from Cloudinary: ${publicId}`)

    const result = await cloudinary.uploader.destroy(publicId)

    if (result.result === 'ok' || result.result === 'not found') {
      res.json({ success: true, result: result.result })
    } else {
      throw new Error(`Cloudinary delete failed: ${result.result}`)
    }
  } catch (err) {
    console.error('Delete error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router;