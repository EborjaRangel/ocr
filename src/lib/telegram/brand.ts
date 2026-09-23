import { InputFile } from "grammy";
import { AXIS_LOGO_JPEG_BASE64 } from "./axisLogoData";

export function axisLogoBuffer(): Buffer {
  return Buffer.from(AXIS_LOGO_JPEG_BASE64, "base64");
}

export function axisLogoFile() {
  return new InputFile(axisLogoBuffer(), "axis-logo.jpg");
}

export const AXIS_START_CAPTION =
  "Hola, soy ChatCoyo, de AXIS. Voy a pedirte celular, correo y una foto de tu INE (puede ser vertical u horizontal).\n\nSi quieres cancelar, escribe /salir.\n\n¿Cuál es tu celular a 10 dígitos?";

export const AXIS_HOLA_CAPTION =
  "Hola, soy ChatCoyo, de AXIS. La foto de la INE puede ir vertical u horizontal.\nSi quieres cancelar, escribe /salir.\n\n¿Cuál es tu celular a 10 dígitos?";

export const AXIS_HOLA_SHORT_CAPTION =
  "Hola, soy ChatCoyo, de AXIS. ¿Cuál es tu celular a 10 dígitos?";

export async function setAxisProfilePhoto(token: string): Promise<{ ok: boolean; description?: string }> {
  const jpeg = axisLogoBuffer();
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

export async function setAxisBotIdentity(token: string): Promise<{
  name: { ok: boolean; description?: string };
  description: { ok: boolean; description?: string };
  short: { ok: boolean; description?: string };
  photo: { ok: boolean; description?: string };
}> {
  const api = (method: string, body: Record<string, string>) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((response) => response.json() as Promise<{ ok: boolean; description?: string }>);

  await fetch(`https://api.telegram.org/bot${token}/deleteMyProfilePhoto`, {
    method: "POST",
  }).catch(() => undefined);

  const [name, description, short, photo] = await Promise.all([
    api("setMyName", { name: "ChatCoyo · AXIS" }),
    api("setMyDescription", {
      description:
        "ChatCoyo de AXIS. Registro de celular, correo y credencial INE en Coyoacán. Escribe /hola para empezar.",
    }),
    api("setMyShortDescription", {
      short_description: "ChatCoyo de AXIS. Registro de credencial INE.",
    }),
    setAxisProfilePhoto(token),
  ]);
  return { name, description, short, photo };
}
