import { NextResponse } from "next/server";
import { recognizeIneCrops } from "@/lib/ocrCrops";

export const runtime = "nodejs";
export const maxDuration = 60;

async function fileToBuffer(value: FormDataEntryValue | null): Promise<Buffer | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  return Buffer.from(await value.arrayBuffer());
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const names = (
      await Promise.all(
        [1, 2].map((index) =>
          fileToBuffer(
            form.get(`names${index}`) ?? (index === 1 ? form.get("names") : null),
          ),
        ),
      )
    ).filter((item): item is Buffer => Boolean(item));

    const curps = (
      await Promise.all(
        [1, 2].map((index) =>
          fileToBuffer(
            form.get(`curp${index}`) ?? (index === 1 ? form.get("curp") : null),
          ),
        ),
      )
    ).filter((item): item is Buffer => Boolean(item));

    const secciones = (
      await Promise.all(
        [1, 2].map((index) =>
          fileToBuffer(
            form.get(`seccion${index}`) ?? (index === 1 ? form.get("seccion") : null),
          ),
        ),
      )
    ).filter((item): item is Buffer => Boolean(item));

    if (names.length + curps.length + secciones.length === 0) {
      return NextResponse.json({ error: "Faltan los recortes" }, { status: 400 });
    }

    const text = await recognizeIneCrops({ names, curps, secciones });
    return NextResponse.json({ text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo leer la imagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
