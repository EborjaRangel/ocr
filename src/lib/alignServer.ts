import sharp from "sharp";
import { CURP_ZONES, NAME_ZONES, SECCION_ZONES, type IneZone } from "./ineZones";

const INE_WIDTH = 1600;
const INE_HEIGHT = 1010;
const INE_RATIO = INE_WIDTH / INE_HEIGHT;
const MAX_CROP_SIDE = 720;

type CardBox = { x: number; y: number; width: number; height: number };

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
  pixels: Buffer,
  w: number,
  h: number,
  channels: number,
  test: (r: number, g: number, b: number) => boolean,
): { rowHits: number[]; colHits: number[] } {
  const rowHits = new Array<number>(h).fill(0);
  const colHits = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * channels;
      if (!test(pixels[i], pixels[i + 1], pixels[i + 2])) continue;
      rowHits[y] += 1;
      colHits[x] += 1;
    }
  }
  for (let y = 0; y < h; y += 1) rowHits[y] /= w;
  for (let x = 0; x < w; x += 1) colHits[x] /= h;
  return { rowHits, colHits };
}

async function findCardBounds(input: Buffer, srcW: number, srcH: number): Promise<CardBox | null> {
  const full: CardBox = { x: 0, y: 0, width: srcW, height: srcH };
  const ratio = srcW / Math.max(1, srcH);
  if (Math.abs(ratio - INE_RATIO) / INE_RATIO < 0.08) return full;

  const scale = Math.min(1, 360 / srcW);
  const w = Math.max(48, Math.round(srcW * scale));
  const h = Math.max(30, Math.round(srcH * scale));
  const preview = await sharp(input).resize(w, h).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = preview.data;
  const channels = preview.info.channels;

  const paper = occupancy(pixels, w, h, channels, isInePaper);
  let [minY, maxY] = firstRun(paper.rowHits, 0.16);
  let [minX, maxX] = firstRun(paper.colHits, 0.16);
  if (minX < 0 || minY < 0) {
    const mixed = occupancy(pixels, w, h, channels, isCardContent);
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

  if (width / height > INE_RATIO) {
    const nextHeight = width / INE_RATIO;
    y -= (nextHeight - height) / 2;
    height = nextHeight;
  } else {
    const nextWidth = height * INE_RATIO;
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
  if (x + width > srcW) width = srcW - x;
  if (y + height > srcH) height = srcH - y;
  if (width < 40 || height < 25) return full;

  const area = (width * height) / (srcW * srcH);
  const boxRatio = width / height;
  if (area > 0.92) return full;
  if (area < 0.22 || boxRatio < 1.25 || boxRatio > 2.1) return full;

  return { x, y, width, height };
}

export async function alignIneBuffer(input: Buffer): Promise<Buffer> {
  let image = sharp(input).rotate();
  const meta = await image.metadata();
  let width = meta.width ?? 0;
  let height = meta.height ?? 0;
  if (height > width) {
    image = image.rotate(90);
    [width, height] = [height, width];
  }

  const oriented = await image.jpeg({ quality: 92 }).toBuffer();
  const orientedMeta = await sharp(oriented).metadata();
  const srcW = orientedMeta.width ?? width;
  const srcH = orientedMeta.height ?? height;
  const box = (await findCardBounds(oriented, srcW, srcH)) ?? {
    x: 0,
    y: 0,
    width: srcW,
    height: srcH,
  };

  return sharp(oriented)
    .extract({
      left: Math.max(0, Math.floor(box.x)),
      top: Math.max(0, Math.floor(box.y)),
      width: Math.max(8, Math.floor(box.width)),
      height: Math.max(8, Math.floor(box.height)),
    })
    .resize(INE_WIDTH, INE_HEIGHT, { fit: "fill" })
    .jpeg({ quality: 92 })
    .toBuffer();
}

export async function flipAligned(aligned: Buffer): Promise<Buffer> {
  return sharp(aligned).rotate(180).jpeg({ quality: 92 }).toBuffer();
}

async function cropZone(aligned: Buffer, zone: IneZone, imageW: number, imageH: number): Promise<Buffer> {
  const left = Math.max(0, Math.floor(imageW * zone.left));
  const top = Math.max(0, Math.floor(imageH * zone.top));
  const width = Math.max(8, Math.min(imageW - left, Math.floor(imageW * (zone.right - zone.left))));
  const height = Math.max(8, Math.min(imageH - top, Math.floor(imageH * (zone.bottom - zone.top))));
  let outW = Math.round(width * zone.scale);
  let outH = Math.round(height * zone.scale);
  const longest = Math.max(outW, outH);
  if (longest > MAX_CROP_SIDE) {
    const fit = MAX_CROP_SIDE / longest;
    outW = Math.max(8, Math.round(outW * fit));
    outH = Math.max(8, Math.round(outH * fit));
  }

  let pipeline = sharp(aligned).extract({ left, top, width, height }).resize(outW, outH);
  if (zone.contrast) {
    pipeline = pipeline.normalize().modulate({ brightness: 1.06 });
  }
  return pipeline.jpeg({ quality: 85 }).toBuffer();
}

export async function cropIneZones(aligned: Buffer): Promise<{
  names: Buffer[];
  curps: Buffer[];
  secciones: Buffer[];
}> {
  const meta = await sharp(aligned).metadata();
  const imageW = meta.width ?? INE_WIDTH;
  const imageH = meta.height ?? INE_HEIGHT;
  const [names, curps, secciones] = await Promise.all([
    Promise.all(NAME_ZONES.map((zone) => cropZone(aligned, zone, imageW, imageH))),
    Promise.all(CURP_ZONES.map((zone) => cropZone(aligned, zone, imageW, imageH))),
    Promise.all(SECCION_ZONES.map((zone) => cropZone(aligned, zone, imageW, imageH))),
  ]);
  return { names, curps, secciones };
}
