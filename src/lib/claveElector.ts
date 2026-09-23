import { CLAVE_ELECTOR_REGEX, CURP_REGEX } from "./validation";

const CLAVE_LOOSE = /^[A-Z]{6}\d{8}[A-Z]\d{3}$/;

const TO_DIGIT: Record<string, string> = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  Z: "2",
  S: "5",
  G: "6",
  B: "8",
};

const TO_LETTER: Record<string, string> = {
  "0": "O",
  "1": "I",
  "2": "Z",
  "5": "S",
  "8": "B",
  "6": "G",
};

function compactAlnum(value: string): string {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .replace(/CLAVE/g, "")
    .replace(/DEELECTOR/g, "")
    .replace(/ELECTOR/g, "");
}

function correctClave(raw: string): string {
  return raw
    .toUpperCase()
    .split("")
    .map((char, index) => {
      if (index <= 5 || index === 14) return TO_LETTER[char] ?? char;
      if ((index >= 6 && index <= 13) || index >= 15) return TO_DIGIT[char] ?? char;
      return char;
    })
    .join("");
}

function looksLikeClave(value: string): boolean {
  return value.length === 18 && (CLAVE_ELECTOR_REGEX.test(value) || CLAVE_LOOSE.test(value));
}

function looksLikeCurp(value: string): boolean {
  return value.length === 18 && CURP_REGEX.test(value);
}

function acceptClave(value: string, curp = ""): string {
  const raw = value.slice(0, 18).toUpperCase();
  if (looksLikeCurp(raw)) return "";
  const candidates = [raw, correctClave(raw)].filter((item) => looksLikeClave(item));
  if (curp.length >= 10) {
    const matching = candidates.find((item) => item.slice(6, 12) === curp.slice(4, 10));
    if (matching) return matching;
  }
  return candidates[0] ?? "";
}

export function extractValidClave(raw: string, curp = ""): string {
  const compact = compactAlnum(raw);
  const labeled = raw.toUpperCase().match(/CLAVE[\sA-Z]*ELECTOR[\s:.-]*([A-Z0-9][A-Z0-9\s]{15,40})/);
  if (labeled?.[1]) {
    const fromLabeled = acceptClave(compactAlnum(labeled[1]), curp);
    if (fromLabeled) return fromLabeled;
  }

  for (let i = 0; i <= compact.length - 18; i += 1) {
    const found = acceptClave(compact.slice(i, i + 18), curp);
    if (found) return found;
  }
  return "";
}

export function extractAllValidClaves(raw: string, curp = ""): string[] {
  const compact = compactAlnum(raw);
  const found = new Set<string>();
  const labeled = raw.toUpperCase().match(/CLAVE[\sA-Z]*ELECTOR[\s:.-]*([A-Z0-9][A-Z0-9\s]{15,40})/);
  const texts = [labeled?.[1] ? compactAlnum(labeled[1]) : "", compact].filter(Boolean);
  for (const text of texts) {
    for (let i = 0; i <= text.length - 18; i += 1) {
      const clave = acceptClave(text.slice(i, i + 18), curp);
      if (clave) found.add(clave);
    }
  }
  return [...found];
}

export function confirmClaveReads(reads: string[], curp = ""): string {
  const valid = reads.filter((value) => looksLikeClave(value) && !looksLikeCurp(value));
  if (valid.length === 0) return "";
  if (curp.length >= 10) {
    const matching = valid.find((value) => value.slice(6, 12) === curp.slice(4, 10));
    if (matching) return matching;
  }
  return valid[0] ?? "";
}
