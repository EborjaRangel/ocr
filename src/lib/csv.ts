import { promises as fs } from "fs";
import path from "path";
import type { ChatCoyoFields, IneFields, IneRecord } from "./types";

const DATA_DIR = process.env.OCR_DATA_DIR
  ? process.env.OCR_DATA_DIR
  : process.env.VERCEL
    ? path.join("/tmp", "ocr-data")
    : path.join(process.cwd(), "data");
const CSV_PATH = path.join(DATA_DIR, "registros.csv");
const HEADERS = [
  "fecha",
  "celular",
  "correo",
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

function normalizeRecord(fields: IneFields & Partial<ChatCoyoFields>): IneRecord {
  return {
    fecha: new Date().toISOString(),
    celular: (fields.celular ?? "").replace(/\D/g, "").slice(-10),
    correo: (fields.correo ?? "").trim().toLowerCase(),
    nombre: fields.nombre.trim().toUpperCase(),
    apellidoPaterno: fields.apellidoPaterno.trim().toUpperCase(),
    apellidoMaterno: fields.apellidoMaterno.trim().toUpperCase(),
    curp: fields.curp.trim().toUpperCase(),
    seccion: fields.seccion.trim().padStart(4, "0").slice(-4),
  };
}

function rowFromCols(header: string[], cols: string[]): IneRecord {
  const get = (name: string, fallbackIndex: number) => {
    const index = header.indexOf(name);
    return (index >= 0 ? cols[index] : cols[fallbackIndex]) ?? "";
  };
  return {
    fecha: get("fecha", 0),
    celular: get("celular", -1),
    correo: get("correo", -1),
    nombre: get("nombre", 1),
    apellidoPaterno: get("apellidoPaterno", 2),
    apellidoMaterno: get("apellidoMaterno", 3),
    curp: get("curp", 4),
    seccion: get("seccion", 5),
  };
}

async function migrateCsv(content: string): Promise<string | null> {
  const lines = content.split(/\r?\n/).filter((line, index) => index === 0 || line.trim());
  if (lines.length === 0) return `${HEADERS.join(",")}\n`;
  const header = parseCsvLine(lines[0] ?? "").map((item) => item.trim());
  if (HEADERS.every((name) => header.includes(name))) return null;

  const rows = lines.slice(1).filter((line) => line.trim());
  const next = [
    HEADERS.join(","),
    ...rows.map((line) => {
      const record = rowFromCols(header, parseCsvLine(line));
      return [
        record.fecha,
        record.celular,
        record.correo,
        record.nombre,
        record.apellidoPaterno,
        record.apellidoMaterno,
        record.curp,
        record.seccion,
      ]
        .map(escapeCsv)
        .join(",");
    }),
  ].join("\n");
  return `${next}\n`;
}

async function ensureCsvFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const content = await fs.readFile(CSV_PATH, "utf8");
    const migrated = await migrateCsv(content);
    if (migrated) await fs.writeFile(CSV_PATH, migrated, "utf8");
  } catch {
    await fs.writeFile(CSV_PATH, `${HEADERS.join(",")}\n`, "utf8");
  }
}

export async function appendRegistro(
  fields: IneFields & Partial<ChatCoyoFields>,
): Promise<IneRecord> {
  const record = normalizeRecord(fields);

  writeQueue = writeQueue.then(async () => {
    await ensureCsvFile();
    const row = [
      record.fecha,
      record.celular,
      record.correo,
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
  const header = parseCsvLine(lines[0] ?? "");

  return lines.slice(1).map((line) => rowFromCols(header, parseCsvLine(line)));
}

export async function getCsvFile(): Promise<{ path: string; content: Buffer }> {
  await ensureCsvFile();
  const content = await fs.readFile(CSV_PATH);
  return { path: CSV_PATH, content };
}
