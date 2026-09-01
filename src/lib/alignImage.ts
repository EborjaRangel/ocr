import { chooseUprightByInstituto } from "./headerOrient";

export const INE_WIDTH = 1600;
export const INE_HEIGHT = 1010;

export type AlignedImage = {
  blob: Blob;
  width: number;
  height: number;
};

async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar la imagen alineada"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.93,
    );
  });
}

async function loadToCanvas(source: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(source);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo leer la imagen"));
      element.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo leer la imagen");
    ctx.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawRotated(
  source: HTMLCanvasElement,
  degrees: 90 | 180 | 270,
): HTMLCanvasElement {
  const srcW = source.width;
  const srcH = source.height;
  const swap = degrees === 90 || degrees === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? srcH : srcW;
  canvas.height = swap ? srcW : srcH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo rotar la imagen");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(source, -srcW / 2, -srcH / 2);
  return canvas;
}

type CardBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function isInePaper(r: number, g: number, b: number): boolean {
  const y = luma(r, g, b);
  const sat = saturation(r, g, b);
  return (
    y >= 140 &&
    y <= 238 &&
    sat >= 0.035 &&
    sat <= 0.42 &&
    r > 135 &&
    r + 10 >= g &&
    g + 8 >= b
  );
}

function isCardContent(r: number, g: number, b: number): boolean {
  if (isInePaper(r, g, b)) return true;
  const y = luma(r, g, b);
  const sat = saturation(r, g, b);
  if (y < 85 && sat < 0.4) return true;
  if (sat > 0.16 && y > 35 && y < 225) return true;
  return false;
}

function firstRun(hits: number[], threshold: number): [number, number] {
  let start = -1;
  let end = -1;
  for (let i = 0; i < hits.length; i += 1) {
    if (hits[i] >= threshold) {
      if (start < 0) start = i;
      end = i;
    }
  }
  return [start, end];
}

function occupancy(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  test: (r: number, g: number, b: number) => boolean,
): { rowHits: number[]; colHits: number[] } {
  const rowHits = new Array<number>(h).fill(0);
  const colHits = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (!test(pixels[i], pixels[i + 1], pixels[i + 2])) continue;
      rowHits[y] += 1;
      colHits[x] += 1;
    }
  }
  for (let y = 0; y < h; y += 1) rowHits[y] /= w;
  for (let x = 0; x < w; x += 1) colHits[x] /= h;
  return { rowHits, colHits };
}

function findCardBounds(source: HTMLCanvasElement): CardBox {
  const full: CardBox = { x: 0, y: 0, width: source.width, height: source.height };
  const scale = Math.min(1, 360 / source.width);
  const w = Math.max(48, Math.round(source.width * scale));
  const h = Math.max(30, Math.round(source.height * scale));
  const preview = document.createElement("canvas");
  preview.width = w;
  preview.height = h;
  const previewCtx = preview.getContext("2d", { willReadFrequently: true });
  if (!previewCtx) return full;
  previewCtx.drawImage(source, 0, 0, w, h);
  const pixels = previewCtx.getImageData(0, 0, w, h).data;

  const paper = occupancy(pixels, w, h, isInePaper);
  let [minY, maxY] = firstRun(paper.rowHits, 0.16);
  let [minX, maxX] = firstRun(paper.colHits, 0.16);
  if (minX < 0 || minY < 0) {
    const mixed = occupancy(pixels, w, h, isCardContent);
    [minY, maxY] = firstRun(mixed.rowHits, 0.18);
    [minX, maxX] = firstRun(mixed.colHits, 0.18);
  }
  if (minX < 0 || minY < 0 || maxX <= minX || maxY <= minY) return full;

  let x = minX / scale;
  let y = minY / scale;
  let width = (maxX - minX + 1) / scale;
  let height = (maxY - minY + 1) / scale;

  const padX = width * 0.06;
  const padTop = height * 0.055;
  const padBottom = height * 0.1;
  x -= padX;
  y -= padTop;
  width += padX * 2;
  height += padTop + padBottom;

  const ratio = INE_WIDTH / INE_HEIGHT;
  if (width / height > ratio) {
    const nextHeight = width / ratio;
    y -= (nextHeight - height) / 2;
    height = nextHeight;
  } else {
    const nextWidth = height * ratio;
    x -= (nextWidth - width) / 2;
    width = nextWidth;
  }

  if (x < 0) {
    width += x;
    x = 0;
  }
  if (y < 0) {
    height += y;
    y = 0;
  }
  if (x + width > source.width) width = source.width - x;
  if (y + height > source.height) height = source.height - y;
  if (width < 40 || height < 25) return full;

  const area = (width * height) / (source.width * source.height);
  const boxRatio = width / height;
  if (area > 0.9) return full;
  if (area < 0.28 || boxRatio < 1.28 || boxRatio > 2.05) return full;

  return { x, y, width, height };
}

function fillCanonical(source: HTMLCanvasElement, box?: CardBox): HTMLCanvasElement {
  const region = box ?? { x: 0, y: 0, width: source.width, height: source.height };
  const canvas = document.createElement("canvas");
  canvas.width = INE_WIDTH;
  canvas.height = INE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    INE_WIDTH,
    INE_HEIGHT,
  );
  return canvas;
}

function cropToBox(source: HTMLCanvasElement, box: CardBox): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(8, Math.round(box.width));
  canvas.height = Math.max(8, Math.round(box.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(
    source,
    box.x,
    box.y,
    box.width,
    box.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

async function cropHeader(source: HTMLCanvasElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const width = Math.max(8, Math.floor(source.width * 0.9));
  const height = Math.max(8, Math.floor(source.height * 0.28));
  canvas.width = Math.round(width * 2);
  canvas.height = Math.round(height * 2);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo recortar el encabezado");
  ctx.drawImage(
    source,
    Math.floor(source.width * 0.03),
    0,
    width,
    height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvasToJpeg(canvas);
}

async function toAligned(source: HTMLCanvasElement): Promise<AlignedImage> {
  const canvas = fillCanonical(source);
  const blob = await canvasToJpeg(canvas);
  return { blob, width: canvas.width, height: canvas.height };
}

export async function alignIneImage(source: Blob): Promise<AlignedImage> {
  let canvas = await loadToCanvas(source);
  if (canvas.height > canvas.width) {
    canvas = drawRotated(canvas, 90);
  }

  const bounds = findCardBounds(canvas);
  if (bounds.width < canvas.width || bounds.height < canvas.height) {
    canvas = cropToBox(canvas, bounds);
  }

  const flipped = drawRotated(canvas, 180);
  const winner = await chooseUprightByInstituto(
    await cropHeader(canvas),
    await cropHeader(flipped),
  );
  return toAligned(winner === 1 ? flipped : canvas);
}

export async function rotateAlignedImage(
  source: Blob,
  degrees: 90 | 180 | 270,
): Promise<AlignedImage> {
  let canvas = drawRotated(await loadToCanvas(source), degrees);
  if (canvas.width >= canvas.height) {
    canvas = fillCanonical(canvas);
  }
  const blob = await canvasToJpeg(canvas);
  return { blob, width: canvas.width, height: canvas.height };
}

function boostContrast(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const factor = 1.45;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, (data[i] - 128) * factor + 128));
    data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - 128) * factor + 128));
    data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - 128) * factor + 128));
  }
  ctx.putImageData(image, 0, 0);
}

export async function cropRegion(
  source: Blob,
  left: number,
  top: number,
  right: number,
  bottom: number,
  scale = 2.4,
  contrast = false,
): Promise<Blob> {
  const image = await loadToCanvas(source);
  const x = Math.floor(image.width * left);
  const y = Math.floor(image.height * top);
  const width = Math.max(8, Math.floor(image.width * (right - left)));
  const height = Math.max(8, Math.floor(image.height * (bottom - top)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo recortar la zona");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
  if (contrast) boostContrast(canvas);
  return canvasToJpeg(canvas);
}

export async function cropPixels(
  source: Blob,
  x: number,
  y: number,
  width: number,
  height: number,
  scale = 3.6,
  contrast = false,
): Promise<Blob> {
  const image = await loadToCanvas(source);
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(8, Math.min(image.width - sx, Math.floor(width)));
  const sh = Math.max(8, Math.min(image.height - sy, Math.floor(height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo recortar la zona");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  if (contrast) boostContrast(canvas);
  return canvasToJpeg(canvas);
}
