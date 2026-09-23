import { cropFieldZones } from "./alignImage";
import { hasAnyIneData, parseIneText } from "./ineParser";
import { CLAVE_ZONES, CURP_ZONES, NAME_ZONES, SECCION_ZONES } from "./ineZones";
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
  claves: string[];
  secciones: string[];
}): string {
  const lines = [parts.fullText];
  parts.names.forEach((text, index) => {
    lines.push(index === 0 ? "===NOMBRES===" : `===NOMBRES${index + 1}===`, "NOMBRE", text);
  });
  parts.curps.forEach((text, index) => {
    lines.push(index === 0 ? "===CURP===" : `===CURP${index + 1}===`, "CURP", text);
  });
  parts.claves.forEach((text, index) => {
    lines.push(index === 0 ? "===CLAVE===" : `===CLAVE${index + 1}===`, "CLAVE DE ELECTOR", text);
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
    claves: Blob[];
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
    const nameModes = [PSM.SINGLE_BLOCK, PSM.SINGLE_BLOCK];
    for (let i = 0; i < images.names.length; i += 1) {
      await worker.setParameters({
        tessedit_pageseg_mode: nameModes[i] ?? PSM.SINGLE_COLUMN,
        preserve_interword_spaces: "1",
      });
      names.push((await worker.recognize(images.names[i])).data.text ?? "");
    }

    const curps: string[] = [];
    const curpModes = [PSM.SINGLE_LINE, PSM.SINGLE_LINE];
    for (let i = 0; i < images.curps.length; i += 1) {
      await worker.setParameters({
        tessedit_pageseg_mode: curpModes[i] ?? PSM.SPARSE_TEXT,
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        preserve_interword_spaces: "0",
      });
      curps.push((await worker.recognize(images.curps[i])).data.text ?? "");
    }

    const claves: string[] = [];
    for (let i = 0; i < images.claves.length; i += 1) {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        preserve_interword_spaces: "0",
      });
      claves.push((await worker.recognize(images.claves[i])).data.text ?? "");
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

    return assembleOcrText({ fullText: "", names, curps, claves, secciones });
  } finally {
    await worker.terminate();
  }
}

export async function readAlignedIne(
  blob: Blob,
  onProgress?: (progress: OcrProgress) => void,
): Promise<IneReadResult> {
  onProgress?.({ status: "Preparando recortes", progress: 30 });
  const crops = await cropFieldZones(blob, [...NAME_ZONES, ...CURP_ZONES, ...CLAVE_ZONES, ...SECCION_ZONES]);
  const names = crops.slice(0, NAME_ZONES.length);
  const curps = crops.slice(NAME_ZONES.length, NAME_ZONES.length + CURP_ZONES.length);
  const claves = crops.slice(
    NAME_ZONES.length + CURP_ZONES.length,
    NAME_ZONES.length + CURP_ZONES.length + CLAVE_ZONES.length,
  );
  const secciones = crops.slice(NAME_ZONES.length + CURP_ZONES.length + CLAVE_ZONES.length);

  let progress = 42;
  onProgress?.({ status: "Leyendo nombre, CURP y sección", progress });
  const tick = setInterval(() => {
    progress = Math.min(86, progress + 4);
    onProgress?.({ status: "Leyendo nombre, CURP y sección", progress });
  }, 350);

  const form = new FormData();
  names.forEach((item, index) => form.append(`names${index + 1}`, item, `nombres${index + 1}.jpg`));
  curps.forEach((item, index) => form.append(`curp${index + 1}`, item, `curp${index + 1}.jpg`));
  claves.forEach((item, index) => form.append(`clave${index + 1}`, item, `clave${index + 1}.jpg`));
  secciones.forEach((item, index) => form.append(`seccion${index + 1}`, item, `seccion${index + 1}.jpg`));

  let text = "";
  try {
    const serverText = await ocrOnServer(form);
    if (serverText && serverText.trim()) text = serverText;
  } catch {
    text = "";
  } finally {
    clearInterval(tick);
  }

  if (!text.trim()) {
    onProgress?.({ status: "Leyendo en el navegador", progress: 30 });
    text = await ocrInBrowser({ full: blob, names, curps, claves, secciones }, onProgress);
  }

  const fields = parseIneText(text);
  return {
    fields: { ...EMPTY_INE_FIELDS, ...fields },
    text,
    foundData: hasAnyIneData(fields) || text.trim().length > 12,
  };
}
