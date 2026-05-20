import sharp from 'sharp';

const MAX_SIZE_BYTES = 200 * 1024; // 200KB

export async function compressImage(inputBuffer) {
  // Pass 1 — resize to 1280px wide, JPEG quality 85
  let result = await sharp(inputBuffer)
    .resize(1280, null, { withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();

  if (result.length <= MAX_SIZE_BYTES) return result;

  // Pass 2 — same size, lower quality
  result = await sharp(result)
    .jpeg({ quality: 70 })
    .toBuffer();

  if (result.length <= MAX_SIZE_BYTES) return result;

  // Pass 3 — resize to 1024px wide, quality 70
  result = await sharp(result)
    .resize(1024, null, { withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();

  return result;
}