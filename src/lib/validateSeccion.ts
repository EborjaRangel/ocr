import { isCoyoacanSeccion, seccionFromLabelToken } from "./coyoacanSeccion";

const FOUR_DIGITS = /^(0\d{3}|5515)$/;

export function isFourDigitSeccion(value: string): boolean {
  return FOUR_DIGITS.test(value) && isCoyoacanSeccion(value);
}

export function validateSeccionToken(raw: string, nearLabel = false): string {
  const four = raw.toUpperCase().replace(/[OQD]/g, "0").replace(/\D/g, "");
  if (four.length === 4 && isFourDigitSeccion(four)) return four;
  if (nearLabel) {
    const padded = seccionFromLabelToken(raw);
    return isFourDigitSeccion(padded) ? padded : "";
  }
  return "";
}

export function pickPreferredSeccion(expectedZone: string[], others: string[]): string {
  const zoneHit = expectedZone.find(isFourDigitSeccion);
  if (zoneHit) return zoneHit;
  return others.find(isFourDigitSeccion) ?? "";
}

export function blockedSeccionFromCurp(curp: string): Set<string> {
  const blocked = new Set<string>(["1111", "0000"]);
  if (!curp || curp.length < 10) return blocked;
  const yy = curp.slice(4, 6);
  if (/^\d{2}$/.test(yy)) {
    blocked.add(`19${yy}`);
    blocked.add(`20${yy}`);
  }
  const date = curp.slice(4, 10);
  for (let i = 0; i <= date.length - 4; i += 1) {
    const four = date.slice(i, i + 4);
    if (/^\d{4}$/.test(four)) blocked.add(four);
  }
  return blocked;
}
