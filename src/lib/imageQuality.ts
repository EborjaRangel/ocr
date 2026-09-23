export const NOT_SHARP_MESSAGE =
  "Vuelve a tomar la foto o imagen ya que no es nítida.";

export const GLARE_MESSAGE =
  "Hay brillos u hologramas sobre los datos. Vuelve a tomar la fotografía sin flash y cambia el ángulo.";

export type ImageQuality = {
  sharp: boolean;
  tooBlurry: boolean;
  glare: boolean;
  hologram: boolean;
  width: number;
  height: number;
  sharpness: number;
};

const MIN_SHORT_SIDE = 420;
const BLUR_THRESHOLD = 38;
const SEVERE_BLUR_THRESHOLD = 18;

const DATA_ZONES = [
  { left: 0.26, top: 0.08, right: 0.88, bottom: 0.5 },
  { left: 0.18, top: 0.42, right: 0.84, bottom: 0.7 },
  { left: 0.58, top: 0.46, right: 0.98, bottom: 0.82 },
];

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

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function hueDeg(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 4) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

function isBurgundy(r: number, g: number, b: number, y: number): boolean {
  return r > 90 && r > g * 1.2 && r > b * 1.2 && y < 145;
}

function isGoldTrim(r: number, g: number, b: number): boolean {
  return r > 140 && g > 95 && b < 110 && r > b + 40 && saturation(r, g, b) > 0.22;
}

function inDataZone(x: number, y: number, width: number, height: number): boolean {
  const nx = x / width;
  const ny = y / height;
  return DATA_ZONES.some(
    (zone) => nx >= zone.left && nx <= zone.right && ny >= zone.top && ny <= zone.bottom,
  );
}

function detectGlareAndHologram(
  imageData: ImageData,
): { glare: boolean; hologram: boolean } {
  const { data, width, height } = imageData;
  const cell = 12;
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const clipCells = new Uint16Array(cols * rows);
  const rainbowCells = new Uint16Array(cols * rows);
  const hueSin = new Float32Array(cols * rows);
  const hueCos = new Float32Array(cols * rows);
  const hueCount = new Uint16Array(cols * rows);
  const cellLuma = new Float32Array(cols * rows);

  let dataPixels = 0;
  let dataClip = 0;
  let dataSpecular = 0;
  let dataRainbow = 0;
  let cardPixels = 0;
  let cardClip = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const yL = luma(r, g, b);
      const sat = saturation(r, g, b);
      const clipped = r > 247 && g > 247 && b > 247;
      const specular = yL > 236 && sat < 0.11;
      cardPixels += 1;
      if (clipped) cardClip += 1;

      const dataZone = inDataZone(x, y, width, height);
      if (!dataZone || isBurgundy(r, g, b, yL) || isGoldTrim(r, g, b)) continue;

      dataPixels += 1;
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const idx = cy * cols + cx;
      cellLuma[idx] += yL;

      if (clipped) {
        dataClip += 1;
        clipCells[idx] += 1;
      }
      if (specular) dataSpecular += 1;

      const rainbow =
        sat > 0.28 &&
        yL > 165 &&
        !(r > g + 35 && r > b + 35);
      if (rainbow) {
        dataRainbow += 1;
        rainbowCells[idx] += 1;
      }

      if (sat > 0.16 && yL > 145) {
        const rad = (hueDeg(r, g, b) * Math.PI) / 180;
        hueSin[idx] += Math.sin(rad);
        hueCos[idx] += Math.cos(rad);
        hueCount[idx] += 1;
      }
    }
  }

  if (dataPixels < 80) return { glare: false, hologram: false };

  const clipRatio = dataClip / dataPixels;
  const specularRatio = dataSpecular / dataPixels;
  const cardClipRatio = cardClip / Math.max(1, cardPixels);
  const rainbowRatio = dataRainbow / dataPixels;

  let hotCells = 0;
  let iridescent = 0;
  for (let idx = 0; idx < clipCells.length; idx += 1) {
    const samples = Math.max(1, Math.floor((cell * cell) / 4));
    if (clipCells[idx] > samples * 0.32) hotCells += 1;
    if (rainbowCells[idx] > samples * 0.22) iridescent += 1;
    if (hueCount[idx] >= 8) {
      const meanSin = hueSin[idx] / hueCount[idx];
      const meanCos = hueCos[idx] / hueCount[idx];
      const R = Math.hypot(meanSin, meanCos);
      const spread = 1 - R;
      const meanY = cellLuma[idx] / hueCount[idx];
      if (spread > 0.38 && meanY > 155) iridescent += 1;
    }
  }

  const glare =
    clipRatio >= 0.016 ||
    specularRatio >= 0.045 ||
    cardClipRatio >= 0.04 ||
    hotCells >= 5;

  const hologram = rainbowRatio >= 0.022 || iridescent >= 7;

  return { glare, hologram };
}

async function sampleImage(source: Blob): Promise<{
  imageData: ImageData;
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(source);
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
  bitmap.close();
  return { imageData, width, height };
}

export async function assessImageQuality(file: Blob): Promise<ImageQuality> {
  const { imageData, width, height } = await sampleImage(file);
  const sharpness = laplacianVariance(toGray(imageData), imageData.width, imageData.height);
  const { glare, hologram } = detectGlareAndHologram(imageData);

  const shortSide = Math.min(width, height);
  const tooSmall = shortSide < MIN_SHORT_SIDE;
  const tooBlurry = tooSmall || sharpness < SEVERE_BLUR_THRESHOLD;
  const sharp = !tooSmall && sharpness >= BLUR_THRESHOLD && !glare && !hologram;

  return { sharp, tooBlurry, glare, hologram, width, height, sharpness };
}

export function retakeReason(quality: ImageQuality): "glare" | "blur" | null {
  if (quality.glare || quality.hologram) return "glare";
  if (quality.tooBlurry) return "blur";
  return null;
}
