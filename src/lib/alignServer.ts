import sharp from "sharp";
import { CURP_ZONES, NAME_ZONES, SECCION_ZONES, type IneZone } from "./ineZones";

const INE_WIDTH = 1600;
const INE_HEIGHT = 1010;
const MAX_CROP_SIDE = 640;

export async function alignIneBuffer(input: Buffer): Promise<Buffer> {
  const rotated = sharp(input).rotate();
  const meta = await rotated.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const pipeline = height > width ? rotated.rotate(90) : rotated;
  return pipeline
    .resize(INE_WIDTH, INE_HEIGHT, { fit: "fill" })
    .jpeg({ quality: 90 })
    .toBuffer();
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
    pipeline = pipeline.normalize().modulate({ brightness: 1.05 });
  }
  return pipeline.jpeg({ quality: 80 }).toBuffer();
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
