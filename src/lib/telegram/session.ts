import type { ChatCoyoFields } from "../types";
import { EMPTY_CHAT_FIELDS } from "../types";

export type ChatStep =
  | "idle"
  | "menu"
  | "nombreBienvenida"
  | "fechaNacimiento"
  | "celular"
  | "correo"
  | "foto"
  | "leyendo"
  | "revision"
  | "editando";

export type EditableField =
  | "celular"
  | "correo"
  | "nombre"
  | "apellidoPaterno"
  | "apellidoMaterno"
  | "curp"
  | "claveElector"
  | "seccion";

export type ChatSession = {
  step: ChatStep;
  editing?: EditableField;
  data: ChatCoyoFields;
  givenName?: string;
  readGen: number;
  lastFileId?: string;
};

const sessions = new Map<number, ChatSession>();

function emptySession(step: ChatStep): ChatSession {
  return { step, data: { ...EMPTY_CHAT_FIELDS }, readGen: 0 };
}

export function getSession(chatId: number): ChatSession {
  const current = sessions.get(chatId);
  if (current) return current;
  const created = emptySession("idle");
  sessions.set(chatId, created);
  return created;
}

export function resetSession(chatId: number): ChatSession {
  const created = emptySession("menu");
  sessions.set(chatId, created);
  return created;
}

export function startAltaSession(chatId: number): ChatSession {
  const created = emptySession("nombreBienvenida");
  sessions.set(chatId, created);
  return created;
}

export function clearSession(chatId: number): void {
  sessions.delete(chatId);
}
