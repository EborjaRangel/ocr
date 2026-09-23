import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { InputFile } from "grammy";

export function axisLogoPngPath() {
  return join(process.cwd(), "public", "axis-logo.png");
}

export function axisLogoJpegPath() {
  return join(process.cwd(), "public", "axis-logo.jpg");
}

export function axisLogoFile() {
  return new InputFile(axisLogoPngPath(), "axis-logo.png");
}

export const AXIS_START_CAPTION =
  "Hola, soy ChatCoyo, de AXIS. Voy a pedirte celular, correo y una foto de tu INE (puede ser vertical u horizontal).\n\nSi quieres cancelar, escribe /salir.\n\n¿Cuál es tu celular a 10 dígitos?";

export const AXIS_HOLA_CAPTION =
  "Hola, soy ChatCoyo, de AXIS. La foto de la INE puede ir vertical u horizontal.\nSi quieres cancelar, escribe /salir.\n\n¿Cuál es tu celular a 10 dígitos?";

export const AXIS_HOLA_SHORT_CAPTION =
  "Hola, soy ChatCoyo, de AXIS. ¿Cuál es tu celular a 10 dígitos?";

export async function setAxisProfilePhoto(token: string): Promise<{ ok: boolean; description?: string }> {
  const jpeg = await readFile(axisLogoJpegPath());
  const form = new FormData();
  form.append(
    "photo",
    JSON.stringify({ type: "static", photo: "attach://logo" }),
  );
  form.append(
    "logo",
    new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }),
    "axis-logo.jpg",
  );
  const response = await fetch(
    `https://api.telegram.org/bot${token}/setMyProfilePhoto`,
    { method: "POST", body: form },
  );
  return (await response.json()) as { ok: boolean; description?: string };
}
