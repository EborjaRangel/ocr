import { cropPixels, cropRegion } from "./alignImage";
import { hasAnyIneData, parseIneText } from "./ineParser";
import { seccionBesideLabel, seccionTargetBoxes, type OcrWord } from "./seccionFromWords";
import type { IneFields, OcrProgress } from "./types";
import { EMPTY_INE_FIELDS } from "./types";

export type IneReadResult = {
  fields: IneFields;
  text: string;
  foundData: boolean;
};

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    "loading tesseract core": "Cargando motor OCR",
    "initializing tesseract": "Inicializando Tesseract",
    "initialized tesseract": "Motor listo",
    "loading language traineddata": "Descargando idioma español",
    "loaded language traineddata": "Idioma cargado",
    "initializing api": "Preparando reconocimiento",
    "initialized api": "Reconocimiento listo",
    "recognizing text": "Leyendo la credencial",
  };
  return labels[status] ?? "Procesando imagen";
}

function assembleOcrText(parts: {
  fullText: string;
  names: string[];
  curps: string[];
  secciones: string[];
}): string {
  const lines = [parts.fullText];
  parts.names.forEach((text, index) => {
    lines.push(index === 0 ? "===NOMBRES===" : `===NOMBRES${index + 1}===`, "NOMBRE", text);
  });
  parts.curps.forEach((text, index) => {
    lines.push(index === 0 ? "===CURP===" : `===CURP${index + 1}===`, "CURP", text);
  });
  parts.secciones.forEach((text, index) => {
    const marker = index === 0 ? "===SECCION===" : `===SECCION${index + 1}===`;
    lines.push(marker, text);
  });
  return lines.join("\n");
}

async function ocrOnServer(form: FormData): Promise<string | null> {
  const response = await fetch("/api/ocr", { method: "POST", body: form });
  if (!response.ok) return null;
  const data = (await response.json()) as { text?: string };
  return typeof data.text === "string" ? data.text : null;
}

async function ocrInBrowser(
  images: {
    full: Blob;
    names: Blob[];
    curps: Blob[];
    secciones: Blob[];
  },
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/tesseract-core-simd-lstm.wasm.js",
    langPath: "/tesseract/lang",
    gzip: true,
    workerBlobURL: false,
    logger: (message) => {
      if (typeof message.progress === "number") {
        onProgress?.({
          status: statusLabel(message.status),
          progress: Math.max(20, Math.round(message.progress * 100)),
        });
      }
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
    });
    const fullText = (await worker.recognize(images.full)).data.text ?? "";

    const names: string[] = [];
    const nameModes = [
      PSM.SINGLE_COLUMN,
      PSM.SINGLE_BLOCK,
      PSM.SPARSE_TEXT,
      PSM.SINGLE_COLUMN,
      PSM.SINGLE_BLOCK,
    ];
    for (let i = 0; i < images.names.length; i += 1) {
      await worker.setParameters({
        tessedit_pageseg_mode: nameModes[i] ?? PSM.SINGLE_COLUMN,
        preserve_interword_spaces: "1",
      });
      names.push((await worker.recognize(images.names[i])).data.text ?? "");
    }

    const curps: string[] = [];
    const curpModes = [
      PSM.SPARSE_TEXT,
      PSM.SINGLE_LINE,
      PSM.SINGLE_BLOCK,
      PSM.SPARSE_TEXT,
      PSM.SINGLE_LINE,
    ];
    for (let i = 0; i < images.curps.length; i += 1) {
      await worker.setParameters({
        tessedit_pageseg_mode: curpModes[i] ?? PSM.SPARSE_TEXT,
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        preserve_interword_spaces: "0",
      });
      curps.push((await worker.recognize(images.curps[i])).data.text ?? "");
    }

    const secciones: string[] = [];
    const seccionModes = [
      PSM.SPARSE_TEXT,
      PSM.SINGLE_BLOCK,
      PSM.SINGLE_LINE,
      PSM.SPARSE_TEXT,
      PSM.SINGLE_BLOCK,
    ];
    for (let i = 0; i < images.secciones.length; i += 1) {
      await worker.setParameters({
        tessedit_pageseg_mode: seccionModes[i] ?? PSM.SPARSE_TEXT,
        tessedit_char_whitelist: "0123456789",
        preserve_interword_spaces: "1",
      });
      secciones.push((await worker.recognize(images.secciones[i])).data.text ?? "");
    }

      return assembleOcrText({ fullText, names, curps, secciones });
  } finally {
    await worker.terminate();
  }
}

function tesseractWords(data: {
  words?: Array<{ text?: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }> | null;
  blocks?: Array<{
    paragraphs?: Array<{
      lines?: Array<{
        words?: Array<{ text?: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }> | null;
      }> | null;
    }> | null;
  }> | null;
}): OcrWord[] {
  const mapped = (data.words ?? [])
    .filter((word) => word.text && word.bbox)
    .map((word) => ({
      text: word.text ?? "",
      bbox: word.bbox as OcrWord["bbox"],
    }));
  if (mapped.length) return mapped;

  const nested: OcrWord[] = [];
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          if (!word.text || !word.bbox) continue;
          nested.push({ text: word.text, bbox: word.bbox });
        }
      }
    }
  }
  return nested;
}

async function seccionCropsAroundLabel(source: Blob): Promise<{
  crops: Blob[];
  fromWords: string;
}> {
  const band = await cropRegion(source, 0, 0.48, 1, 1, 2);
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/tesseract-core-simd-lstm.wasm.js",
    langPath: "/tesseract/lang",
    gzip: true,
    workerBlobURL: false,
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1",
    });
    const result = await worker.recognize(band);
    const words = tesseractWords(result.data);
    const fromWords = seccionBesideLabel(words);
    const bitmap = await createImageBitmap(band);
    const boxes = seccionTargetBoxes(words, bitmap.width, bitmap.height);
    bitmap.close();
    if (boxes.length === 0) {
      return {
        fromWords,
        crops: [
          await cropRegion(source, 0.48, 0.5, 0.95, 0.82, 3.4),
          await cropRegion(source, 0.52, 0.52, 0.92, 0.78, 4.0, true),
          await cropRegion(source, 0.45, 0.48, 0.88, 0.86, 3.0),
          await cropRegion(source, 0.55, 0.54, 0.9, 0.76, 4.6),
          await cropRegion(source, 0.5, 0.56, 0.85, 0.8, 3.6, true),
        ],
      };
    }

    const crops = await Promise.all(
      boxes.map((box, index) =>
        cropPixels(band, box.x, box.y, box.width, box.height, 4 + index * 0.4, index > 0),
      ),
    );
    return { crops, fromWords };
  } finally {
    await worker.terminate();
  }
}

export async function readAlignedIne(
  blob: Blob,
  onProgress?: (progress: OcrProgress) => void,
): Promise<IneReadResult> {
  onProgress?.({ status: "Preparando 5 lecturas de cada campo", progress: 12 });
  const names = [
    await cropRegion(blob, 0.02, 0.18, 0.6, 0.48, 2.8),
    await cropRegion(blob, 0.02, 0.16, 0.58, 0.46, 3.2, true),
    await cropRegion(blob, 0.01, 0.2, 0.62, 0.5, 3.6),
    await cropRegion(blob, 0.0, 0.14, 0.64, 0.52, 2.4),
    await cropRegion(blob, 0.03, 0.19, 0.56, 0.44, 4.0, true),
  ];
  const curps = [
    await cropRegion(blob, 0.02, 0.46, 0.7, 0.74, 3.8),
    await cropRegion(blob, 0.03, 0.5, 0.58, 0.67, 4.2, true),
    await cropRegion(blob, 0.01, 0.48, 0.64, 0.7, 5.0, true),
    await cropRegion(blob, 0.0, 0.44, 0.66, 0.76, 3.2),
    await cropRegion(blob, 0.04, 0.51, 0.55, 0.69, 4.6),
  ];
  let located = { crops: [] as Blob[], fromWords: "" };
  try {
    located = await seccionCropsAroundLabel(blob);
  } catch {
    located = { crops: [], fromWords: "" };
  }
  const fallbackSecciones = [
    () => cropRegion(blob, 0.48, 0.5, 0.95, 0.82, 3.4),
    () => cropRegion(blob, 0.52, 0.52, 0.92, 0.78, 4.0, true),
    () => cropRegion(blob, 0.45, 0.48, 0.88, 0.86, 3.0),
    () => cropRegion(blob, 0.55, 0.54, 0.9, 0.76, 4.6),
    () => cropRegion(blob, 0.5, 0.56, 0.85, 0.8, 3.6, true),
  ];
  const secciones = [...located.crops];
  for (const makeCrop of fallbackSecciones) {
    if (secciones.length >= 5) break;
    secciones.push(await makeCrop());
  }

  onProgress?.({ status: "Comparando las 5 lecturas de cada campo", progress: 20 });

  const form = new FormData();
  form.append("image", blob, "ine.jpg");
  names.forEach((item, index) => form.append(`names${index + 1}`, item, `nombres${index + 1}.jpg`));
  curps.forEach((item, index) => form.append(`curp${index + 1}`, item, `curp${index + 1}.jpg`));
  secciones.forEach((item, index) => form.append(`seccion${index + 1}`, item, `seccion${index + 1}.jpg`));

  let text = "";
  try {
    const serverText = await ocrOnServer(form);
    if (serverText && serverText.trim()) text = serverText;
  } catch {
    text = "";
  }

  if (!text.trim()) {
    onProgress?.({ status: "Leyendo en el navegador", progress: 30 });
    text = await ocrInBrowser({ full: blob, names, curps, secciones }, onProgress);
  }

  if (located.fromWords) {
    text = `${text}\n===SECCION===\nSECCIÓN ${located.fromWords}`;
  }

  const fields = parseIneText(text);
  return {
    fields: { ...EMPTY_INE_FIELDS, ...fields },
    text,
    foundData: hasAnyIneData(fields) || text.trim().length > 12,
  };
}
