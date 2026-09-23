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
