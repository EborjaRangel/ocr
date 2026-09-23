import { PSM, type Worker } from "tesseract.js";
import type { OcrWord } from "./seccionFromWords";
import { withOcrWorker } from "./tesseractServer";

async function setMode(worker: Worker, mode: PSM, spaces = "1"): Promise<void> {
  await worker.setParameters({
    tessedit_pageseg_mode: mode,
    tessedit_char_whitelist: "",
    preserve_interword_spaces: spaces,
  });
}

async function recognize(worker: Worker, image: Buffer, mode: PSM, spaces = "1"): Promise<string> {
  await setMode(worker, mode, spaces);
  return (await worker.recognize(image)).data.text ?? "";
}

function wordsFrom(data: { words?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> }): OcrWord[] {
  return (data.words ?? []).map((word) => ({
    text: word.text,
    bbox: {
      x0: word.bbox.x0,
      y0: word.bbox.y0,
      x1: word.bbox.x1,
      y1: word.bbox.y1,
    },
  }));
}

export async function recognizeImageWords(
  image: Buffer,
  mode: PSM = PSM.SPARSE_TEXT,
): Promise<{ text: string; words: OcrWord[] }> {
  return withOcrWorker(async (worker) => {
    await setMode(worker, mode);
    const result = await worker.recognize(image);
    return {
      text: result.data.text ?? "",
      words: wordsFrom(result.data as { words?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> }),
    };
  });
}

export async function recognizeIneCrops(crops: {
  full?: Buffer;
  names: Buffer[];
  curps: Buffer[];
  secciones: Buffer[];
  seccionTemplate?: Buffer;
}): Promise<string> {
  return withOcrWorker(async (worker) => {
    const parts: string[] = [];

    if (crops.full) {
      parts.push(await recognize(worker, crops.full, PSM.AUTO));
    }

    for (let i = 0; i < crops.names.length; i += 1) {
      parts.push(i === 0 ? "===NOMBRES===" : `===NOMBRES${i + 1}===`);
      parts.push("NOMBRE");
      parts.push(await recognize(worker, crops.names[i], PSM.SINGLE_BLOCK));
    }

    for (let i = 0; i < crops.curps.length; i += 1) {
      parts.push(i === 0 ? "===CURP===" : `===CURP${i + 1}===`);
      parts.push("CURP");
      parts.push(await recognize(worker, crops.curps[i], PSM.SINGLE_LINE, "0"));
    }

    if (crops.seccionTemplate) {
      parts.push("===ZONASECCION===");
      parts.push(await recognize(worker, crops.seccionTemplate, PSM.SPARSE_TEXT));
    }

    const seccionModes = [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK];
    for (let i = 0; i < crops.secciones.length; i += 1) {
      parts.push(i === 0 ? "===SECCION===" : `===SECCION${i + 1}===`);
      parts.push(await recognize(worker, crops.secciones[i], seccionModes[i] ?? PSM.SPARSE_TEXT));
    }

    return parts.join("\n");
  });
}
