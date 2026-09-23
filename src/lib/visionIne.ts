import sharp from "sharp";
import { extractValidClave } from "./claveElector";
import { extractValidCurp } from "./curp";
import type { IneFields } from "./types";
import { EMPTY_INE_FIELDS } from "./types";
import { CLAVE_ELECTOR_REGEX, CURP_REGEX, NAME_REGEX } from "./validation";
import { isFourDigitSeccion, validateSeccionToken } from "./validateSeccion";

const PROMPT = `Lee el frente de una credencial INE de México. Extrae solo estos campos.
Responde únicamente un JSON válido, sin markdown:

{"nombre":"","apellidoPaterno":"","apellidoMaterno":"","curp":"","claveElector":"","seccion":""}

Reglas:
- nombre: solo nombre(s) de pila, no apellidos.
- apellidoPaterno y apellidoMaterno van separados, como en la credencial.
- curp: 18 caracteres. No lo confundas con la clave de elector.
- claveElector: 18 caracteres de CLAVE DE ELECTOR. No es el CURP.
- seccion: 4 dígitos junto a la etiqueta SECCIÓN.
- Todo en mayúsculas. Si un dato no se ve, usa "".`;

export function hasVisionOcr(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
}

function cleanName(value: unknown): string {
  const name = String(value ?? "")
    .toUpperCase()
    .normalize("NFC")
    .replace(/[^A-ZÁÉÍÓÚÜÑ\s.'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name.length >= 2 && NAME_REGEX.test(name) ? name : "";
}

function asFields(raw: unknown): IneFields {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const curp = extractValidCurp(String(data.curp ?? "")) || (
    CURP_REGEX.test(String(data.curp ?? "").toUpperCase().replace(/\s/g, ""))
      ? String(data.curp).toUpperCase().replace(/\s/g, "")
      : ""
  );
  const clave = extractValidClave(String(data.claveElector ?? ""), curp) || (
    CLAVE_ELECTOR_REGEX.test(String(data.claveElector ?? "").toUpperCase().replace(/\s/g, ""))
      ? String(data.claveElector).toUpperCase().replace(/\s/g, "")
      : ""
  );
  const seccion = validateSeccionToken(String(data.seccion ?? ""), true);
  return {
    ...EMPTY_INE_FIELDS,
    nombre: cleanName(data.nombre),
    apellidoPaterno: cleanName(data.apellidoPaterno),
    apellidoMaterno: cleanName(data.apellidoMaterno),
    curp,
    claveElector: clave && clave !== curp ? clave : "",
    seccion: isFourDigitSeccion(seccion) ? seccion : "",
  };
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*|```$/g, "").trim();
  return JSON.parse(trimmed) as unknown;
}

async function toVisionJpeg(input: Buffer): Promise<Buffer> {
  const image = sharp(input).rotate();
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const longest = Math.max(width, meta.height ?? 0);
  const resized =
    longest > 1600
      ? image.resize({ width: Math.round(width * (1600 / longest)), withoutEnlargement: true })
      : image;
  return resized.jpeg({ quality: 85 }).toBuffer();
}

async function readWithGemini(jpeg: Buffer, apiKey: string): Promise<IneFields> {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  let lastError = "Gemini no respondió";
  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: "image/jpeg", data: jpeg.toString("base64") } },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );
    const payload = (await response.json()) as {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    if (!response.ok) {
      lastError = payload.error?.message ?? `Gemini ${response.status}`;
      continue;
    }
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text.trim()) {
      lastError = "Gemini no devolvió texto";
      continue;
    }
    return asFields(parseJsonObject(text));
  }
  throw new Error(lastError);
}

async function readWithOpenAI(jpeg: Buffer, apiKey: string): Promise<IneFields> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
            },
          ],
        },
      ],
    }),
  });
  const payload = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI ${response.status}`);
  }
  return asFields(parseJsonObject(payload.choices?.[0]?.message?.content ?? "{}"));
}

export async function readIneWithVision(input: Buffer): Promise<IneFields> {
  const jpeg = await toVisionJpeg(input);
  const gemini = process.env.GEMINI_API_KEY;
  if (gemini) return readWithGemini(jpeg, gemini);
  const openai = process.env.OPENAI_API_KEY;
  if (openai) return readWithOpenAI(jpeg, openai);
  throw new Error("Falta GEMINI_API_KEY o OPENAI_API_KEY");
}
