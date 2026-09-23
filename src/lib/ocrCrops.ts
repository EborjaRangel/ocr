import { PSM } from "tesseract.js";
import { withOcrWorker } from "./tesseractServer";

export async function recognizeIneCrops(crops: {
  names: Buffer[];
  curps: Buffer[];
  secciones: Buffer[];
}): Promise<string> {
  return withOcrWorker(async (worker) => {
    const parts: string[] = [];

    for (let i = 0; i < crops.names.length; i += 1) {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
      });
      parts.push(i === 0 ? "===NOMBRES===" : `===NOMBRES${i + 1}===`);
      parts.push("NOMBRE");
      parts.push((await worker.recognize(crops.names[i])).data.text ?? "");
    }

    for (let i = 0; i < crops.curps.length; i += 1) {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        preserve_interword_spaces: "0",
      });
      parts.push(i === 0 ? "===CURP===" : `===CURP${i + 1}===`);
      parts.push("CURP");
      parts.push((await worker.recognize(crops.curps[i])).data.text ?? "");
    }

    const seccionModes = [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK];
    const seccionLists = [
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      "0123456789",
    ];
    for (let i = 0; i < crops.secciones.length; i += 1) {
      await worker.setParameters({
        tessedit_pageseg_mode: seccionModes[i] ?? PSM.SPARSE_TEXT,
        tessedit_char_whitelist: seccionLists[i] ?? "0123456789",
        preserve_interword_spaces: "1",
      });
      parts.push(i === 0 ? "===SECCION===" : `===SECCION${i + 1}===`);
      parts.push((await worker.recognize(crops.secciones[i])).data.text ?? "");
    }

    return parts.join("\n");
  });
}
