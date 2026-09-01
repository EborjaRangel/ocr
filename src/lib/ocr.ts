import { cropRegion } from "./alignImage";
import { hasAnyIneData, parseIneText } from "./ineParser";
import { CURP_ZONES, NAME_ZONES, SECCION_ZONES } from "./ineZones";
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
    const names: string[] = [];
    const nameModes = [PSM.SINGLE_COLUMN, PSM.SINGLE_BLOCK];
    for (let i = 0; i < images.names.length; i += 1) {
      await worker.setParameters({
        tessedit_pageseg_mode: nameModes[i] ?? PSM.SINGLE_COLUMN,
        preserve_interword_spaces: "1",
      });
      names.push((await worker.recognize(images.names[i])).data.text ?? "");
    }

    const curps: string[] = [];
    const curpModes = [PSM.SPARSE_TEXT, PSM.SINGLE_LINE];
    for (let i = 0; i < images.curps.length; i += 1) {
      await worker.setParameters({
        tessedit_pageseg_mode: curpModes[i] ?? PSM.SPARSE_TEXT,
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        preserve_interword_spaces: "0",
      });
      curps.push((await worker.recognize(images.curps[i])).data.text ?? "");
    }

    const secciones: string[] = [];
    const seccionModes = [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK];
    const seccionLists = [
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      "0123456789",
    ];
    for (let i = 0; i < images.secciones.length; i += 1) {
      await worker.setParameters({
        tessedit_pageseg_mode: seccionModes[i] ?? PSM.SPARSE_TEXT,
        tessedit_char_whitelist: seccionLists[i] ?? "0123456789",
        preserve_interword_spaces: "1",
      });
      secciones.push((await worker.recognize(images.secciones[i])).data.text ?? "");
    }

      return assembleOcrText({ fullText: "", names, curps, secciones });
  } finally {
    await worker.terminate();
  }
}

export async function readAlignedIne(
  blob: Blob,
  onProgress?: (progress: OcrProgress) => void,
): Promise<IneReadResult> {
  onProgress?.({ status: "Preparando recortes de cada campo", progress: 28 });
  const names = await Promise.all(
    NAME_ZONES.map((zone) =>
      cropRegion(blob, zone.left, zone.top, zone.right, zone.bottom, zone.scale, zone.contrast),
    ),
  );
  onProgress?.({ status: "Preparando recortes de CURP y sección", progress: 36 });
  const [curps, secciones] = await Promise.all([
    Promise.all(
      CURP_ZONES.map((zone) =>
        cropRegion(blob, zone.left, zone.top, zone.right, zone.bottom, zone.scale, zone.contrast),
      ),
    ),
    Promise.all(
      SECCION_ZONES.map((zone) =>
        cropRegion(blob, zone.left, zone.top, zone.right, zone.bottom, zone.scale, zone.contrast),
      ),
    ),
  ]);

  onProgress?.({ status: "Leyendo la credencial", progress: 42 });

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

  const fields = parseIneText(text);
  return {
    fields: { ...EMPTY_INE_FIELDS, ...fields },
    text,
    foundData: hasAnyIneData(fields) || text.trim().length > 12,
  };
}
