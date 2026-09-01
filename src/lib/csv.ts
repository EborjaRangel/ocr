import { promises as fs } from "fs";
import path from "path";
import type { IneFields, IneRecord } from "./types";

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "ocr-data")
  : path.join(process.cwd(), "data");
const CSV_PATH = path.join(DATA_DIR, "registros.csv");
const HEADERS = [
  "fecha",
  "nombre",
  "apellidoPaterno",
  "apellidoMaterno",
  "curp",
  "seccion",
] as const;

let writeQueue: Promise<void> = Promise.resolve();

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

async function ensureCsvFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(CSV_PATH);
  } catch {
    await fs.writeFile(CSV_PATH, `${HEADERS.join(",")}\n`, "utf8");
  }
}

export async function appendRegistro(fields: IneFields): Promise<IneRecord> {
  const record: IneRecord = {
    fecha: new Date().toISOString(),
    nombre: fields.nombre.trim().toUpperCase(),
    apellidoPaterno: fields.apellidoPaterno.trim().toUpperCase(),
    apellidoMaterno: fields.apellidoMaterno.trim().toUpperCase(),
    curp: fields.curp.trim().toUpperCase(),
    seccion: fields.seccion.trim().padStart(4, "0").slice(-4),
  };

  writeQueue = writeQueue.then(async () => {
    await ensureCsvFile();
    const row = [
      record.fecha,
      record.nombre,
      record.apellidoPaterno,
      record.apellidoMaterno,
      record.curp,
      record.seccion,
    ]
      .map(escapeCsv)
      .join(",");
    await fs.appendFile(CSV_PATH, `${row}\n`, "utf8");
  });

  await writeQueue;
  return record;
}

export async function listRegistros(): Promise<IneRecord[]> {
  try {
    await ensureCsvFile();
  } catch {
    return [];
  }
  const content = await fs.readFile(CSV_PATH, "utf8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) return [];

  return lines.slice(1).map((line) => {
    const [fecha, nombre, apellidoPaterno, apellidoMaterno, curp, seccion] =
      parseCsvLine(line);
    return {
      fecha: fecha ?? "",
      nombre: nombre ?? "",
      apellidoPaterno: apellidoPaterno ?? "",
      apellidoMaterno: apellidoMaterno ?? "",
      curp: curp ?? "",
      seccion: seccion ?? "",
    };
  });
}

export async function getCsvFile(): Promise<{ path: string; content: Buffer }> {
  await ensureCsvFile();
  const content = await fs.readFile(CSV_PATH);
  return { path: CSV_PATH, content };
}
