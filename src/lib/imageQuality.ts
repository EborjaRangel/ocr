export const NOT_SHARP_MESSAGE =
  "Vuelve a tomar la foto o imagen ya que no es nítida.";

export type ImageQuality = {
  sharp: boolean;
  tooBlurry: boolean;
  width: number;
  height: number;
  sharpness: number;
};

const MIN_SHORT_SIDE = 420;
const BLUR_THRESHOLD = 38;
const SEVERE_BLUR_THRESHOLD = 18;

function toGray(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
  }
  return gray;
}

function laplacianVariance(gray: Uint8Array, width: number, height: number): number {
  const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];
  let count = 0;
  let sum = 0;
  let sumSq = 0;

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      let acc = 0;
      let k = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          acc += gray[(y + ky) * width + (x + kx)] * kernel[k];
          k += 1;
        }
      }
      sum += acc;
      sumSq += acc * acc;
      count += 1;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

export async function assessImageQuality(file: File): Promise<ImageQuality> {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  const scale = 640 / Math.max(width, 1);
  const sampleW = Math.max(8, Math.round(width * Math.min(1, scale)));
  const sampleH = Math.max(8, Math.round(height * Math.min(1, scale)));

  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error("No se pudo analizar la imagen");
  }

  ctx.drawImage(bitmap, 0, 0, sampleW, sampleH);
  const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
  const sharpness = laplacianVariance(toGray(imageData), sampleW, sampleH);
  bitmap.close();

  const shortSide = Math.min(width, height);
  const tooSmall = shortSide < MIN_SHORT_SIDE;
  const tooBlurry = tooSmall || sharpness < SEVERE_BLUR_THRESHOLD;
  const sharp = !tooSmall && sharpness >= BLUR_THRESHOLD;

  return { sharp, tooBlurry, width, height, sharpness };
}
