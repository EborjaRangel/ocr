export const COYOACAN_SECCION_EXCEPCION = "5515";

export function isCoyoacanSeccion(value: string): boolean {
  return (
    value === COYOACAN_SECCION_EXCEPCION ||
    (/^0\d{3}$/.test(value) && value !== "0000")
  );
}

export function normalizeSeccionToken(raw: string): string {
  const mapped = raw.toUpperCase().replace(/[OQD]/g, "0");
  const digits = mapped.replace(/\D/g, "");
  if (digits === COYOACAN_SECCION_EXCEPCION) return COYOACAN_SECCION_EXCEPCION;
  if (digits.length === 4) return isCoyoacanSeccion(digits) ? digits : "";
  return "";
}

export function pickCoyoacanSeccion(candidates: string[]): string {
  const unique = [...new Set(candidates.filter(isCoyoacanSeccion))];
  const typical = unique.filter(
    (value) => value.startsWith("0") && value !== "0001",
  );
  if (typical.length) return typical[0];
  if (unique.includes("0001")) return "0001";
  if (unique.includes(COYOACAN_SECCION_EXCEPCION)) {
    return COYOACAN_SECCION_EXCEPCION;
  }
  return "";
}

export function tokensCoyoacanEnTexto(text: string): string[] {
  const folded = text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const found: string[] = [];
  for (const match of folded.matchAll(/(?<![0-9])(0\d{3}|5515)(?![0-9])/g)) {
    if (match[1] !== "0000") found.push(match[1]);
  }
  return found.filter(isCoyoacanSeccion);
}
