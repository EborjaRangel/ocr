import { NextResponse } from "next/server";
import path from "path";
import { createWorker, PSM } from "tesseract.js";

export const runtime = "nodejs";
export const maxDuration = 120;

async function fileToBuffer(value: FormDataEntryValue | null): Promise<Buffer | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  return Buffer.from(await value.arrayBuffer());
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const full = await fileToBuffer(form.get("image"));
    if (!full) {
      return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
    }

    const names = (
      await Promise.all(
        [1, 2, 3, 4, 5].map((index) =>
          fileToBuffer(
            form.get(`names${index}`) ?? (index === 1 ? form.get("names") : null),
          ),
        ),
      )
    ).filter((item): item is Buffer => Boolean(item));

    const curps = (
      await Promise.all(
        [1, 2, 3, 4, 5].map((index) =>
          fileToBuffer(
            form.get(`curp${index}`) ?? (index === 1 ? form.get("curp") : null),
          ),
        ),
      )
    ).filter((item): item is Buffer => Boolean(item));

    const secciones = (
      await Promise.all(
        [1, 2, 3, 4, 5].map((index) =>
          fileToBuffer(
            form.get(`seccion${index}`) ?? (index === 1 ? form.get("seccion") : null),
          ),
        ),
      )
    ).filter((item): item is Buffer => Boolean(item));

    const langPath = path.join(process.cwd(), "public", "tesseract", "lang");
    const worker = await createWorker("spa", 1, {
      langPath,
      gzip: true,
      cacheMethod: "none",
    });

    try {
      const parts: string[] = [];

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
      });
      parts.push((await worker.recognize(full)).data.text ?? "");

      const nameModes = [
        PSM.SINGLE_COLUMN,
        PSM.SINGLE_BLOCK,
        PSM.SPARSE_TEXT,
        PSM.SINGLE_COLUMN,
        PSM.SINGLE_BLOCK,
      ];
      for (let i = 0; i < names.length; i += 1) {
        await worker.setParameters({
          tessedit_pageseg_mode: nameModes[i] ?? PSM.SINGLE_COLUMN,
          preserve_interword_spaces: "1",
        });
        parts.push(i === 0 ? "===NOMBRES===" : `===NOMBRES${i + 1}===`);
        parts.push("NOMBRE");
        parts.push((await worker.recognize(names[i])).data.text ?? "");
      }

      const curpModes = [
        PSM.SPARSE_TEXT,
        PSM.SINGLE_LINE,
        PSM.SINGLE_BLOCK,
        PSM.SPARSE_TEXT,
        PSM.SINGLE_LINE,
      ];
      for (let i = 0; i < curps.length; i += 1) {
        await worker.setParameters({
          tessedit_pageseg_mode: curpModes[i] ?? PSM.SPARSE_TEXT,
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
          preserve_interword_spaces: "0",
        });
        parts.push(i === 0 ? "===CURP===" : `===CURP${i + 1}===`);
        parts.push("CURP");
        parts.push((await worker.recognize(curps[i])).data.text ?? "");
      }

      const seccionModes = [
        PSM.SPARSE_TEXT,
        PSM.SINGLE_BLOCK,
        PSM.SINGLE_LINE,
        PSM.SPARSE_TEXT,
        PSM.SINGLE_BLOCK,
      ];
      for (let i = 0; i < secciones.length; i += 1) {
        await worker.setParameters({
          tessedit_pageseg_mode: seccionModes[i] ?? PSM.SPARSE_TEXT,
          tessedit_char_whitelist: "0123456789",
          preserve_interword_spaces: "1",
        });
        parts.push(i === 0 ? "===SECCION===" : `===SECCION${i + 1}===`);
        parts.push((await worker.recognize(secciones[i])).data.text ?? "");
      }

      return NextResponse.json({ text: parts.join("\n") });
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo leer la imagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
