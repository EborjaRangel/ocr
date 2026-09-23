import sharp from "sharp";
import type { IneVersion } from "./ineTemplates";

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function fold(text: string): string {
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function qrScore(pixels: Buffer, w: number, h: number, channels: number): number {
  const left = Math.floor(w * 0.7);
  const top = Math.floor(h * 0.18);
  const right = Math.floor(w * 0.96);
  const bottom = Math.floor(h * 0.64);
  const cell = 4;
  const means: number[] = [];

  for (let y = top; y + cell < bottom; y += cell) {
    for (let x = left; x + cell < right; x += cell) {
      let sum = 0;
      let count = 0;
      for (let dy = 0; dy < cell; dy += 1) {
        for (let dx = 0; dx < cell; dx += 1) {
          const i = ((y + dy) * w + (x + dx)) * channels;
          sum += luma(pixels[i], pixels[i + 1], pixels[i + 2]);
          count += 1;
        }
      }
      means.push(sum / Math.max(1, count));
    }
  }

  if (means.length < 8) return 0;
  const avg = means.reduce((a, b) => a + b, 0) / means.length;
  const variance = means.reduce((a, b) => a + (b - avg) ** 2, 0) / means.length;
  if (variance > 2200) return 4;
  if (variance > 1400) return 3;
  if (variance > 900) return 1;
  return 0;
}

function paperScore(pixels: Buffer, w: number, h: number, channels: number): { cream: number; pearl: number } {
  let cream = 0;
  let pearl = 0;
  let samples = 0;
  const x0 = Math.floor(w * 0.28);
  const x1 = Math.floor(w * 0.62);
  const y0 = Math.floor(h * 0.2);
  const y1 = Math.floor(h * 0.55);

  for (let y = y0; y < y1; y += 3) {
    for (let x = x0; x < x1; x += 3) {
      const i = (y * w + x) * channels;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const yv = luma(r, g, b);
      const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b));
      samples += 1;
      if (yv > 150 && sat > 0.07 && r >= g && g >= b - 6) cream += 1;
      if (yv > 175 && sat < 0.07) pearl += 1;
    }
  }

  return {
    cream: cream / Math.max(1, samples),
    pearl: pearl / Math.max(1, samples),
  };
}

export async function detectIneVersion(aligned: Buffer, hintText = ""): Promise<IneVersion> {
  const preview = await sharp(aligned)
    .resize(200, 126)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = preview;
  const qr = qrScore(data, info.width, info.height, info.channels);
  const paper = paperScore(data, info.width, info.height, info.channels);
  const text = fold(hintText);

  let cic = qr;
  let classic = paper.cream >= 0.28 ? 2 : 0;
  if (paper.pearl >= 0.35) cic += 2;
  if (/CIC|APELLIDO PATERNO|APELLIDO MATERNO/.test(text)) cic += 4;
  if (/CLAVE DE ELECTOR/.test(text) && !/CIC/.test(text)) classic += 2;

  if (qr >= 4 && cic >= classic) return "cic";
  if (classic >= 2) return "c";
  return "d";
}
