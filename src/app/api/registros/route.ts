import { NextResponse } from "next/server";
import { ValidationError } from "yup";
import { appendRegistro, listRegistros } from "@/lib/csv";
import { ineSchema } from "@/lib/validation";

export async function GET() {
  try {
    const registros = await listRegistros();
    return NextResponse.json({ registros });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudieron leer los registros";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const fields = await ineSchema.validate(body, {
      abortEarly: false,
      stripUnknown: true,
    });
    const registro = await appendRegistro(fields);
    return NextResponse.json({ registro }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.errors[0] ?? "Datos inválidos" },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "No se pudo guardar el registro";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
