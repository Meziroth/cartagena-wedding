// Shrinks a photo in the browser before upload: longest side at most 1600px, saved as JPEG.
// Phone photos are often 4–12 MB; this makes them a few hundred KB and removes location data (EXIF).
import { fitWithin } from './ideas';

export const MAX_SIDE = 1600;
const QUALITY = 0.82;

export class ImageError extends Error {}

export async function resizeImage(file: Blob, max = MAX_SIDE): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    // from-image applies the photo's rotation, so portrait phone pictures stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError('unreadable');
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('unreadable');
  // JPEG has no transparency: paint PNG backgrounds white instead of black.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new ImageError('unreadable');
  return blob;
}
