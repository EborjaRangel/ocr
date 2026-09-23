import type { ChatCoyoFields } from "../types";
import { EMPTY_CHAT_FIELDS } from "../types";

export type ChatStep = "idle" | "celular" | "correo" | "foto" | "leyendo" | "revision" | "editando";

export type EditableField = keyof ChatCoyoFields;

export type ChatSession = {
  step: ChatStep;
  editing?: EditableField;
  data: ChatCoyoFields;
};

const sessions = new Map<number, ChatSession>();

export function getSession(chatId: number): ChatSession {
  const current = sessions.get(chatId);
  if (current) return current;
  const created: ChatSession = { step: "idle", data: { ...EMPTY_CHAT_FIELDS } };
  sessions.set(chatId, created);
  return created;
}

export function resetSession(chatId: number): ChatSession {
  const created: ChatSession = { step: "celular", data: { ...EMPTY_CHAT_FIELDS } };
  sessions.set(chatId, created);
  return created;
}

export function clearSession(chatId: number): void {
  sessions.delete(chatId);
}
