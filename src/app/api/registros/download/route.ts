import { NextResponse } from "next/server";
import { getCsvFile } from "@/lib/csv";

export async function GET() {
  try {
    const { content } = await getCsvFile();
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="registros-ine.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo descargar el CSV";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
