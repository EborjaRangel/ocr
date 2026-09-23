import { Bot, InlineKeyboard, type Context } from "grammy";
import { appendRegistro } from "../csv";
import { readInePhoto } from "../readInePhoto";
import { hasVisionOcr } from "../visionIne";
import type { ChatCoyoFields } from "../types";
import {
  AXIS_HOLA_CAPTION,
  AXIS_HOLA_SHORT_CAPTION,
  AXIS_START_CAPTION,
  axisLogoFile,
} from "./brand";
import {
  CELULAR_REGEX,
  CORREO_REGEX,
  CLAVE_ELECTOR_REGEX,
  CURP_REGEX,
  NAME_REGEX,
  chatCoyoSchema,
} from "../validation";
import {
  type ChatSession,
  type EditableField,
  clearSession,
  getSession,
  resetSession,
} from "./session";

const FIELD_LABELS: Record<EditableField, string> = {
  celular: "Celular",
  correo: "Correo",
  nombre: "Nombre",
  apellidoPaterno: "Apellido paterno",
  apellidoMaterno: "Apellido materno",
  curp: "CURP",
  claveElector: "Clave de elector",
  seccion: "Sección",
};

const FIELD_HINTS: Record<EditableField, string> = {
  celular: "Escribe tu celular a 10 dígitos, sin espacios.",
  correo: "Escribe tu correo electrónico.",
  nombre: "Escribe el nombre como aparece en la INE.",
  apellidoPaterno: "Escribe el apellido paterno.",
  apellidoMaterno: "Escribe el apellido materno.",
  curp: "Escribe el CURP de 18 caracteres.",
  claveElector: "Escribe la clave de elector de 18 caracteres.",
  seccion: "Escribe la sección (0 + 3 dígitos, o 5515).",
};

let botInstance: Bot | null = null;
const seenUpdates = new Map<number, number>();
const seenFiles = new Map<string, number>();

function alreadyHandled(id: number, ttlMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  for (const [key, at] of seenUpdates) {
    if (now - at > ttlMs) seenUpdates.delete(key);
  }
  if (seenUpdates.has(id)) return true;
  seenUpdates.set(id, now);
  return false;
}

function alreadyReadingFile(fileId: string, ttlMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  for (const [key, at] of seenFiles) {
    if (now - at > ttlMs) seenFiles.delete(key);
  }
  if (seenFiles.has(fileId)) return true;
  seenFiles.set(fileId, now);
  return false;
}

function show(value: string): string {
  return value.trim() ? value : "—";
}

function reviewKeyboard() {
  return new InlineKeyboard()
    .text("Sí, guardar", "ok")
    .row()
    .text("Celular", "e:celular")
    .text("Correo", "e:correo")
    .row()
    .text("Nombre", "e:nombre")
    .text("Paterno", "e:apellidoPaterno")
    .row()
    .text("Materno", "e:apellidoMaterno")
    .text("CURP", "e:curp")
    .row()
    .text("Clave elector", "e:claveElector")
    .text("Sección", "e:seccion")
    .text("Otra foto INE", "foto")
    .row()
    .text("Salir", "salir");
}

function summaryText(data: ChatCoyoFields): string {
  return [
    "Revisa tus datos:",
    "",
    `Celular: ${show(data.celular)}`,
    `Correo: ${show(data.correo)}`,
    `Nombre: ${show(data.nombre)}`,
    `Paterno: ${show(data.apellidoPaterno)}`,
    `Materno: ${show(data.apellidoMaterno)}`,
    `CURP: ${show(data.curp)}`,
    `Clave de elector: ${show(data.claveElector)}`,
    `Sección: ${show(data.seccion)}`,
    "",
    "Si un dato no se leyó o está mal, toca su botón. Si todo está bien, toca Sí, guardar.",
  ].join("\n");
}

async function showReview(ctx: Context, session: ChatSession) {
  session.step = "revision";
  session.editing = undefined;
  await ctx.reply(summaryText(session.data), { reply_markup: reviewKeyboard() });
}

function startRegistro(chatId: number): ChatSession {
  return resetSession(chatId);
}

async function exitChat(ctx: Context, chatId: number) {
  clearSession(chatId);
  await ctx.reply("Saliste de ChatCoyo. El registro no se guardó.\nCuando quieras empezar de nuevo, escribe /hola");
}

function normalizeField(field: EditableField, raw: string): { value: string; error?: string } {
  const value = raw.trim();
  if (field === "celular") {
    const digits = value.replace(/\D/g, "");
    if (!CELULAR_REGEX.test(digits)) {
      return { value: digits, error: "El celular debe tener 10 dígitos." };
    }
    return { value: digits };
  }
  if (field === "correo") {
    const correo = value.toLowerCase();
    if (!CORREO_REGEX.test(correo)) {
      return { value: correo, error: "Ese correo no es válido." };
    }
    return { value: correo };
  }
  if (field === "curp") {
    const curp = value.toUpperCase().replace(/\s/g, "");
    if (!CURP_REGEX.test(curp)) {
      return { value: curp, error: "El CURP debe tener 18 caracteres y un formato válido." };
    }
    return { value: curp };
  }
  if (field === "claveElector") {
    const clave = value.toUpperCase().replace(/\s/g, "");
    if (!CLAVE_ELECTOR_REGEX.test(clave) && !/^[A-Z]{6}\d{8}[A-Z]\d{3}$/.test(clave)) {
      return { value: clave, error: "La clave de elector debe tener 18 caracteres y un formato válido." };
    }
    return { value: clave };
  }
  if (field === "seccion") {
    const seccion = value.replace(/\D/g, "").padStart(4, "0").slice(-4);
    if (!/^(0\d{3}|5515)$/.test(seccion)) {
      return { value: seccion, error: "La sección debe ser 0 + 3 dígitos, o 5515." };
    }
    return { value: seccion };
  }
  const name = value.toUpperCase();
  if (!NAME_REGEX.test(name) || name.length < 2) {
    return { value: name, error: "Usa solo letras, como en la credencial." };
  }
  return { value: name };
}

async function downloadImage(ctx: Context): Promise<Buffer | null> {
  const photos = ctx.message?.photo;
  const fileId = photos?.length
    ? photos[photos.length - 1]?.file_id
    : ctx.message?.document?.mime_type?.startsWith("image/")
      ? ctx.message.document.file_id
      : undefined;
  if (!fileId) return null;
  const file = await ctx.api.getFile(fileId);
  if (!file.file_path) return null;
  const url = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

function hasIneFields(data: ChatCoyoFields): boolean {
  return Boolean(
    data.nombre.trim() &&
      data.apellidoPaterno.trim() &&
      data.curp.trim() &&
      data.seccion.trim(),
  );
}

function isWaitingForUser(session: ChatSession): boolean {
  return session.step === "revision" || session.step === "editando";
}

async function readPhotoAndReview(
  ctx: Context,
  session: ChatSession,
  image: Buffer,
  gen: number,
) {
  session.step = "leyendo";
  try {
    const result = await readInePhoto(image);
    if (session.readGen !== gen) return;
    if (isWaitingForUser(session)) return;
    session.data = { ...session.data, ...result.fields };
    if (!result.foundData) {
      await ctx.reply(
        "No pude leer bien la INE. Puedes tocar el botón de cada dato o mandar otra foto.",
      );
    }
    await showReview(ctx, session);
  } catch (error) {
    if (session.readGen !== gen || isWaitingForUser(session)) return;
    session.step = "foto";
    await ctx.reply(
      error instanceof Error
        ? `No se pudo leer la foto: ${error.message}. Mándala de nuevo, nítida y de frente.`
        : "No se pudo leer la foto. Mándala de nuevo.",
    );
  }
}

function photoFileId(ctx: Context): string | undefined {
  const photos = ctx.message?.photo;
  if (photos?.length) return photos[photos.length - 1]?.file_id;
  if (ctx.message?.document?.mime_type?.startsWith("image/")) {
    return ctx.message.document.file_id;
  }
  return undefined;
}

async function acceptInePhoto(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const session = getSession(chatId);
  const fileId = photoFileId(ctx);
  if (fileId && alreadyReadingFile(fileId)) return;

  if (session.step === "leyendo") return;

  if (isWaitingForUser(session) && hasIneFields(session.data)) {
    await ctx.reply(
      "Ya tengo los datos. Usa los botones para corregir o guardar. Si quieres otra foto, toca Otra foto INE.",
    );
    return;
  }

  if (session.step !== "foto" && !isWaitingForUser(session)) {
    await ctx.reply("Primero el celular, luego el correo y al final la foto de la INE. Escribe /hola para empezar.");
    return;
  }

  const image = await downloadImage(ctx);
  if (!image) {
    await ctx.reply("No pude bajar la foto. Inténtalo otra vez.");
    return;
  }
  session.readGen += 1;
  const gen = session.readGen;
  session.lastFileId = fileId;
  session.step = "leyendo";
  await ctx.reply(
    hasVisionOcr()
      ? "Leyendo la INE con el modelo de visión. Espera un momento…"
      : "Leyendo la credencial INE. Espera un momento…",
  );
  void readPhotoAndReview(ctx, session, image, gen);
}

function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.use(async (ctx, next) => {
    if (alreadyHandled(ctx.update.update_id)) return;
    await next();
  });

  bot.command("start", async (ctx) => {
    const chatId = ctx.chat.id;
    startRegistro(chatId);
    await ctx.replyWithPhoto(axisLogoFile(), { caption: AXIS_START_CAPTION });
  });

  bot.command("hola", async (ctx) => {
    const chatId = ctx.chat.id;
    startRegistro(chatId);
    await ctx.replyWithPhoto(axisLogoFile(), { caption: AXIS_HOLA_CAPTION });
  });

  bot.command("salir", async (ctx) => {
    await exitChat(ctx, ctx.chat.id);
  });

  bot.command("cancelar", async (ctx) => {
    await exitChat(ctx, ctx.chat.id);
  });

  bot.hears(/^(hola)$/i, async (ctx) => {
    const chatId = ctx.chat.id;
    startRegistro(chatId);
    await ctx.replyWithPhoto(axisLogoFile(), { caption: AXIS_HOLA_SHORT_CAPTION });
  });

  bot.hears(/^(salir|cancelar)$/i, async (ctx) => {
    await exitChat(ctx, ctx.chat.id);
  });

  bot.on("callback_query:data", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const session = getSession(chatId);
    const data = ctx.callbackQuery.data;
    await ctx.answerCallbackQuery();

    if (data === "ok") {
      try {
        const fields = await chatCoyoSchema.validate(session.data, {
          abortEarly: false,
          stripUnknown: true,
        });
        await appendRegistro(fields);
        clearSession(chatId);
        await ctx.reply(
          "Datos guardados. Gracias.\nPara otro registro escribe /hola",
        );
      } catch {
        await ctx.reply(
          "Todavía falta un dato o alguno no es válido. Toca el botón del campo y corrígelo.",
        );
        await showReview(ctx, session);
      }
      return;
    }

    if (data === "salir") {
      await exitChat(ctx, chatId);
      return;
    }

    if (session.step === "leyendo") {
      await ctx.reply("Todavía estoy leyendo la foto. Espera un momento.");
      return;
    }

    if (data === "foto") {
      session.step = "foto";
      session.editing = undefined;
      if (session.lastFileId) {
        seenFiles.delete(session.lastFileId);
        session.lastFileId = undefined;
      }
      await ctx.reply(
        "Manda otra foto de la INE, nítida, sin flash, con el nombre hacia arriba.",
      );
      return;
    }

    if (data.startsWith("e:")) {
      const field = data.slice(2) as EditableField;
      if (!(field in FIELD_LABELS)) return;
      session.step = "editando";
      session.editing = field;
      await ctx.reply(FIELD_HINTS[field]);
    }
  });

  bot.on("message:photo", async (ctx) => {
    await acceptInePhoto(ctx);
  });

  bot.on("message:document", async (ctx) => {
    if (!ctx.message.document?.mime_type?.startsWith("image/")) return;
    await acceptInePhoto(ctx);
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (/^\/?(hola|start|salir|cancelar)$/i.test(text)) return;
    const session = getSession(ctx.chat.id);

    if (session.step === "celular") {
      const parsed = normalizeField("celular", text);
      if (parsed.error) {
        await ctx.reply(parsed.error);
        return;
      }
      session.data.celular = parsed.value;
      session.step = "correo";
      await ctx.reply("¿Cuál es tu correo electrónico?");
      return;
    }

    if (session.step === "correo") {
      const parsed = normalizeField("correo", text);
      if (parsed.error) {
        await ctx.reply(parsed.error);
        return;
      }
      session.data.correo = parsed.value;
      session.step = "foto";
      await ctx.reply(
        "Manda una foto de tu INE, vertical u horizontal. Que se vea nítida y sin flash. Para cancelar, /salir",
      );
      return;
    }

    if (session.step === "editando" && session.editing) {
      const parsed = normalizeField(session.editing, text);
      if (parsed.error) {
        await ctx.reply(parsed.error);
        return;
      }
      session.data[session.editing] = parsed.value;
      await showReview(ctx, session);
      return;
    }

    if (session.step === "leyendo") {
      await ctx.reply("Todavía estoy leyendo la foto. Espera un momento.");
      return;
    }

    if (session.step === "foto") {
      await ctx.reply("Necesito la foto de la INE, no un texto.");
      return;
    }

    if (session.step === "revision") {
      await ctx.reply("Usa los botones para corregir un dato o para guardar.");
      return;
    }

    await ctx.reply("Escribe /hola para empezar un registro con ChatCoyo.");
  });

  bot.catch((error) => {
    console.error("ChatCoyo", error);
  });

  return bot;
}

export function getChatCoyoBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Falta TELEGRAM_BOT_TOKEN");
  }
  if (!botInstance) {
    botInstance = createBot(token);
  }
  return botInstance;
}
