import { PSM, type Worker } from "tesseract.js";
import { withOcrWorker } from "./tesseractServer";

async function recognize(
  worker: Worker,
  image: Buffer,
  mode: number,
  spaces = "1",
): Promise<string> {
  await worker.setParameters({
    tessedit_pageseg_mode: mode,
    tessedit_char_whitelist: "",
    preserve_interword_spaces: spaces,
  });
  return (await worker.recognize(image)).data.text ?? "";
}

export async function recognizeIneCrops(crops: {
  full?: Buffer;
  names: Buffer[];
  curps: Buffer[];
  secciones: Buffer[];
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

    const seccionModes = [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK];
    for (let i = 0; i < crops.secciones.length; i += 1) {
      parts.push(i === 0 ? "===SECCION===" : `===SECCION${i + 1}===`);
      parts.push(await recognize(worker, crops.secciones[i], seccionModes[i] ?? PSM.SPARSE_TEXT));
    }

    return parts.join("\n");
  });
}
