import { NextResponse } from "next/server";
import path from "path";
import { createWorker, PSM } from "tesseract.js";
import { scoreInstitutoHeader } from "@/lib/institutoHeader";

export const runtime = "nodejs";
export const maxDuration = 60;

async function fileToBuffer(value: FormDataEntryValue | null): Promise<Buffer | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  return Buffer.from(await value.arrayBuffer());
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const headerA = await fileToBuffer(form.get("a"));
    const headerB = await fileToBuffer(form.get("b"));
    if (!headerA || !headerB) {
      return NextResponse.json({ error: "Faltan las franjas superiores" }, { status: 400 });
    }

    const langPath = path.join(process.cwd(), "public", "tesseract", "lang");
    const worker = await createWorker("spa", 1, {
      langPath,
      gzip: true,
      cacheMethod: "none",
    });

    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
      });
      const textA = (await worker.recognize(headerA)).data.text ?? "";
      const textB = (await worker.recognize(headerB)).data.text ?? "";
      return NextResponse.json({
        textA,
        textB,
        scoreA: scoreInstitutoHeader(textA),
        scoreB: scoreInstitutoHeader(textB),
      });
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo orientar la imagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
