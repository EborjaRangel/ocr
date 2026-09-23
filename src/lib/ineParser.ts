import { seccionCandidatesInText, tokensCoyoacanEnTexto } from "./coyoacanSeccion";
import { blockedSeccionFromCurp, isFourDigitSeccion } from "./validateSeccion";
import { confirmClaveReads, extractAllValidClaves } from "./claveElector";
import { confirmCurpReads, extractAllValidCurps, prefixesFromPaterno } from "./curp";
import type { IneFields } from "./types";
import { EMPTY_INE_FIELDS } from "./types";
import { confirmNameReads, confirmVotes } from "./voteFields";

const SURNAME_PARTICLES = new Set([
  "DE",
  "DEL",
  "LA",
  "LAS",
  "LOS",
  "Y",
  "SAN",
  "SANTA",
  "MC",
  "MAC",
  "DA",
  "DI",
]);

const GARBAGE = new Set([
  "DOMICILIO",
  "CALLE",
  "COLONIA",
  "COL",
  "SEXO",
  "CURP",
  "CLAVE",
  "ELECTOR",
  "SECCION",
  "SECCIÓN",
  "ESTADO",
  "MUNICIPIO",
  "LOCALIDAD",
  "EMISION",
  "EMISIÓN",
  "VIGENCIA",
  "CREDENCIAL",
  "INSTITUTO",
  "NACIONAL",
  "ELECTORAL",
  "MEXICO",
  "MÉXICO",
  "NOMBRE",
  "NOMBRES",
  "APELLIDO",
  "APELLIDOS",
  "PATERNO",
  "MATERNO",
  "REGISTRO",
  "FECHA",
  "NACIMIENTO",
  "PARA",
  "VOTAR",
  "FEDERAL",
  "FEDERACION",
  "FEDERACIÓN",
  "ESTADOS",
  "UNIDOS",
  "MEXICANOS",
  "MEXICANO",
  "CIC",
  "OCR",
  "INE",
  "ANDADOR",
  "AVENIDA",
  "AV",
  "CALLEJON",
  "PRIVADA",
  "NUMERO",
  "NUM",
  "BARRIO",
  "DELEGACION",
  "ALCALDIA",
  "COYOACAN",
  "CDMX",
  "CP",
]);

function fold(text: string): string {
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[|]/g, "I")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(text: string): string {
  return fold(text).replace(/\s/g, "");
}

function linesOf(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function nameWords(line: string): string[] {
  return line
    .toUpperCase()
    .replace(/[^A-ZÁÉÍÓÚÜÑ\s.'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length >= 2 && !GARBAGE.has(fold(word)));
}

function cleanSurname(line: string): string {
  const words = nameWords(line);
  if (words.length === 0) return "";

  const taken: string[] = [];
  for (const word of words) {
    if (
      SURNAME_PARTICLES.has(fold(word)) &&
      taken.every((item) => SURNAME_PARTICLES.has(fold(item)))
    ) {
      taken.push(word);
      continue;
    }
    taken.push(word);
    break;
  }
  return taken.join(" ");
}

function cleanGivenName(line: string): string {
  return nameWords(line).join(" ");
}

function firstSurnameLetter(value: string): string {
  const words = value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ñ/g, "X")
    .split(/[^A-Z]+/)
    .filter((word) => word && !SURNAME_PARTICLES.has(word));
  return words[0]?.[0] ?? "";
}

function surnamesOnLine(line: string): string[] {
  const words = nameWords(line);
  const found: string[] = [];
  let i = 0;
  while (i < words.length) {
    const taken: string[] = [];
    while (i < words.length && SURNAME_PARTICLES.has(fold(words[i]))) {
      taken.push(words[i]);
      i += 1;
    }
    if (i >= words.length) break;
    taken.push(words[i]);
    i += 1;
    found.push(taken.join(" "));
  }
  return found;
}

function isJunkNameLine(line: string): boolean {
  const folded = fold(line);
  return /CREDENCIAL|INSTITUTO|NACIONAL ELECTORAL|ESTADOS UNIDOS|MEXICANOS|PARA VOTAR|^PARA$|^VOTAR$|FEDERACI|MEXICO|DOMICILIO|CLAVE DE ELECTOR|CLAVE DE ELECT|SEXO|VIGENCIA/.test(
    folded,
  );
}

function isNombreLabel(line: string): boolean {
  const value = compact(line).replace(/[^A-Z0-9]/g, "");
  return /^(N[O0]MBRES?)$/.test(value);
}

function isCurpLabel(line: string): boolean {
  const value = compact(line);
  return value === "CURP" || (value.startsWith("CURP") && value.length <= 22);
}

function isSeccionLabel(line: string): boolean {
  const value = compact(line);
  return /^SECC(?:ION|I0N|JON)/.test(value) && value.length <= 16;
}

function sameName(a: string, b: string): boolean {
  return Boolean(a) && Boolean(b) && fold(a) === fold(b);
}

function collectNameBlock(
  lines: string[],
  start: number,
): Pick<IneFields, "nombre" | "apellidoPaterno" | "apellidoMaterno"> {
  const block: string[] = [];
  for (let j = start + 1; j < lines.length && block.length < 3; j += 1) {
    if (isNombreLabel(lines[j])) continue;
    if (isCurpLabel(lines[j]) || isSeccionLabel(lines[j])) break;
    if (isJunkNameLine(lines[j])) continue;
    if (/^(DOMICILIO|CLAVE|SEXO|ESTADO|MUNICIPIO|CALLE|COLONIA)/.test(fold(lines[j]))) {
      if (block.length >= 2) break;
      continue;
    }
    if (nameWords(lines[j]).length === 0) continue;
    const cleaned = block.length < 2 ? cleanSurname(lines[j]) : cleanGivenName(lines[j]);
    if (!cleaned) continue;
    if (block.some((item) => sameName(item, cleaned))) continue;
    block.push(cleaned);
  }

  if (block.length === 1) {
    const parts = surnamesOnLine(block[0]);
    if (parts.length >= 3) {
      return {
        apellidoPaterno: parts[0] ?? "",
        apellidoMaterno: parts[1] ?? "",
        nombre: parts.slice(2).join(" "),
      };
    }
    return {
      apellidoPaterno: block[0] ?? "",
      apellidoMaterno: "",
      nombre: "",
    };
  }

  return {
    apellidoPaterno: block[0] ?? "",
    apellidoMaterno: block[1] ?? "",
    nombre: block[2] ?? "",
  };
}

function scoreNames(
  value: Pick<IneFields, "nombre" | "apellidoPaterno" | "apellidoMaterno">,
): number {
  const junk = new Set(["PARA", "VOTAR", "FEDERAL", "MEXICO", "MEXICO"]);
  const surnameScore = (item: string) => {
    if (!item) return 0;
    if (junk.has(fold(item))) return -3;
    return item.length >= 4 ? 2 : 1;
  };
  const nombreOk =
    Boolean(value.nombre) &&
    !sameName(value.nombre, value.apellidoPaterno) &&
    !sameName(value.nombre, value.apellidoMaterno);
  return (
    surnameScore(value.apellidoPaterno) +
    surnameScore(value.apellidoMaterno) +
    (nombreOk ? 3 : value.nombre ? -2 : 0)
  );
}

function extractNamesFromLines(
  lines: string[],
  allowOrphan = false,
): Pick<IneFields, "nombre" | "apellidoPaterno" | "apellidoMaterno"> {
  let best = {
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
  };

  const starts: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (isNombreLabel(lines[i])) starts.push(i);
  }

  if (starts.length === 0 && allowOrphan && lines.length > 0) {
    starts.push(-1);
  }

  for (const i of starts) {
    const candidate = collectNameBlock(lines, i);
    if (scoreNames(candidate) > scoreNames(best)) best = candidate;
  }

  return best;
}

function numberedBlocks(rawText: string, base: string, count = 2): string[] {
  const blocks = [blockAfter(rawText, `===${base}===`)];
  for (let i = 2; i <= count; i += 1) {
    blocks.push(blockAfter(rawText, `===${base}${i}===`));
  }
  return blocks;
}

function nextNameAfterLabel(
  lines: string[],
  start: number,
  surname: boolean,
): string {
  for (let j = start; j < Math.min(start + 3, lines.length); j += 1) {
    if (isNombreLabel(lines[j]) || isCurpLabel(lines[j]) || isSeccionLabel(lines[j])) continue;
    if (isJunkNameLine(lines[j])) continue;
    if (/APELLIDO|NOMBRE/.test(fold(lines[j])) && nameWords(lines[j]).length <= 2) continue;
    const cleaned = surname ? cleanSurname(lines[j]) : cleanGivenName(lines[j]);
    if (cleaned) return cleaned;
  }
  return "";
}

function extractLabeledNames(
  lines: string[],
): Pick<IneFields, "nombre" | "apellidoPaterno" | "apellidoMaterno"> {
  let apellidoPaterno = "";
  let apellidoMaterno = "";
  let nombre = "";

  for (let i = 0; i < lines.length; i += 1) {
    const folded = fold(lines[i]);
    const sameLine = (label: RegExp, surname: boolean) => {
      const leftover = folded.replace(label, "").trim();
      if (!leftover) return "";
      return surname ? cleanSurname(leftover) : cleanGivenName(leftover);
    };

    if (/APELLIDO PATERNO/.test(folded) && !apellidoPaterno) {
      apellidoPaterno = sameLine(/.*APELLIDO PATERNO/, true) || nextNameAfterLabel(lines, i + 1, true);
    } else if (/APELLIDO MATERNO/.test(folded) && !apellidoMaterno) {
      apellidoMaterno = sameLine(/.*APELLIDO MATERNO/, true) || nextNameAfterLabel(lines, i + 1, true);
    } else if (/\bNOMBRES?\b/.test(folded) && !/APELLIDO/.test(folded) && !nombre) {
      nombre = sameLine(/.*NOMBRES?/, false) || nextNameAfterLabel(lines, i + 1, false);
    }
  }

  return { nombre, apellidoPaterno, apellidoMaterno };
}

function nameLinesFrom(lines: string[]): Array<{ surname: string; given: string }> {
  const found: Array<{ surname: string; given: string }> = [];
  for (const line of lines) {
    if (isNombreLabel(line) || isCurpLabel(line) || isSeccionLabel(line)) continue;
    if (isJunkNameLine(line)) continue;
    if (/APELLIDO|NOMBRE/.test(fold(line)) && nameWords(line).length <= 2) continue;
    const surname = cleanSurname(line);
    const given = cleanGivenName(line);
    if (!surname && !given) continue;
    found.push({ surname, given });
  }
  return found;
}

function namesMatchingCurp(
  lines: string[],
  curp: string,
): Pick<IneFields, "nombre" | "apellidoPaterno" | "apellidoMaterno"> {
  const empty = { nombre: "", apellidoPaterno: "", apellidoMaterno: "" };
  if (!curp || curp.length < 4) return empty;
  const items = nameLinesFrom(lines);
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      for (let k = j + 1; k < items.length; k += 1) {
        const candidate = {
          apellidoPaterno: items[i].surname,
          apellidoMaterno: items[j].surname,
          nombre: items[k].given,
        };
        if (
          paternoFitsCurp(candidate.apellidoPaterno, curp) &&
          maternoFitsCurp(candidate.apellidoMaterno, curp) &&
          nombreFitsCurp(candidate.nombre, curp)
        ) {
          return candidate;
        }
      }
    }
  }

  const used = new Set<string>();
  const pick = (
    test: (value: string) => boolean,
    key: "surname" | "given",
  ): string => {
    const hit = items.find((item) => {
      const value = item[key];
      return value && test(value) && !used.has(fold(value));
    });
    if (!hit) return "";
    used.add(fold(hit[key]));
    return hit[key];
  };

  return {
    apellidoPaterno: pick((value) => paternoFitsCurp(value, curp), "surname"),
    apellidoMaterno: pick((value) => maternoFitsCurp(value, curp), "surname"),
    nombre: pick((value) => nombreFitsCurp(value, curp), "given"),
  };
}

function collectNameReads(
  rawText: string,
  lines: string[],
): Array<Pick<IneFields, "nombre" | "apellidoPaterno" | "apellidoMaterno">> {
  const beforeCrops = linesOf(
    (rawText.split("===NOMBRES===")[0] ?? rawText).split("===CURP")[0],
  );
  const fullLines = beforeCrops.length ? beforeCrops : lines;
  const fromFull = extractNamesFromLines(fullLines, false);
  const fromLabels = extractLabeledNames(fullLines);
  const fromCrops = numberedBlocks(rawText, "NOMBRES", 2).flatMap((block) => {
    const cropLines = linesOf(block);
    return [extractNamesFromLines(cropLines, true), extractLabeledNames(cropLines)];
  });
  return [fromFull, fromLabels, ...fromCrops].filter((item) => scoreNames(item) > 0);
}

function paternoFitsCurp(apellidoPaterno: string, curp: string): boolean {
  if (!apellidoPaterno || curp.length < 2) return false;
  const head = curp.slice(0, 2);
  return prefixesFromPaterno(apellidoPaterno)
    .filter((prefix) => prefix.length >= 2)
    .some((prefix) => prefix === head);
}

function maternoFitsCurp(apellidoMaterno: string, curp: string): boolean {
  if (curp.length < 3) return false;
  if (curp[2] === "X" && !apellidoMaterno) return true;
  return firstSurnameLetter(apellidoMaterno) === curp[2];
}

function nombreFitsCurp(nombre: string, curp: string): boolean {
  if (!nombre || curp.length < 4) return false;
  return firstSurnameLetter(nombre) === curp[3];
}

function blockAfter(rawText: string, marker: string): string {
  return (rawText.split(marker)[1] ?? "").split("===")[0];
}

function extractCurp(
  rawText: string,
  lines: string[],
  apellidoPaterno: string,
): string {
  const blocks = [...numberedBlocks(rawText, "CURP", 2), rawText];
  const reads = blocks.flatMap((block) =>
    extractAllValidCurps(block, apellidoPaterno),
  );

  for (let i = 0; i < lines.length; i += 1) {
    if (!isCurpLabel(lines[i])) continue;
    const afterLabel = compact(lines[i]).replace(/^CURP/, "");
    const nearby = [afterLabel, ...lines.slice(i + 1, i + 4)].join("");
    reads.push(...extractAllValidCurps(nearby, apellidoPaterno));
  }

  let curp = confirmCurpReads(reads, apellidoPaterno);
  if (curp) return curp;

  const firstLetter = apellidoPaterno.trim().slice(0, 1);
  if (firstLetter) {
    const loose = blocks.flatMap((block) => extractAllValidCurps(block, firstLetter));
    curp = confirmCurpReads(loose, firstLetter);
    if (curp && curp[0] === firstLetter.toUpperCase()) return curp;
  }

  return confirmCurpReads(
    blocks.flatMap((block) => extractAllValidCurps(block, "")),
    apellidoPaterno,
  );
}

const SECCION_LABEL = /S[E3]CC(?:ION|I0N|JON|10N|1ON)/;

function isSeccionHeader(line: string): boolean {
  return SECCION_LABEL.test(compact(line).replace(/[^A-Z0-9]/g, ""));
}

function isYear(value: string): boolean {
  const n = Number(value);
  return n >= 1900 && n <= 2099;
}

function isDateOrCurpLine(line: string): boolean {
  return /(NACIMIENTO|FECHA|A[NÑ]O|CURP|VIGENCIA|EMISION)/.test(fold(line));
}

function birthYearFromCurp(curp: string): Set<string> {
  return blockedSeccionFromCurp(curp);
}

function isAllowedSeccion(value: string, blocked: Set<string>): boolean {
  return (
    isFourDigitSeccion(value) &&
    !isYear(value) &&
    !blocked.has(value)
  );
}

function firstAllowedSeccion(candidates: string[], blocked: Set<string>): string {
  return candidates.find((value) => isAllowedSeccion(value, blocked)) ?? "";
}

function seccionFromCoyoacanGrid(text: string, blocked: Set<string>): string {
  const folded = fold(text);
  const grid = folded.match(/09\s*014\s*(0\d{3}|5515)/);
  if (grid?.[1] && isAllowedSeccion(grid[1], blocked)) return grid[1];
  return "";
}

function seccionAfterLabelInRaw(raw: string, blocked: Set<string>): string {
  const compacted = compact(raw).replace(/[^A-Z0-9]/g, "");
  const index = compacted.search(/S[E3]CC(?:ION|I0N|JON|10N|1ON)/);
  if (index < 0) return "";
  const after = compacted.slice(index).replace(/^S[E3]CC(?:ION|I0N|JON|10N|1ON)/, "");
  return firstAllowedSeccion(seccionCandidatesInText(after.slice(0, 28), true), blocked);
}

function seccionToTheRight(line: string, blocked: Set<string>): string {
  const folded = fold(line);
  const afterLabel = folded.replace(/.*?S[E3]CC(?:ION|I0N|JON|10N|1ON)\s*/i, "");
  if (afterLabel === folded) return "";
  return firstAllowedSeccion(seccionCandidatesInText(afterLabel.slice(0, 20), true), blocked);
}

function domicilioFalseSecciones(raw: string): Set<string> {
  const folded = fold(raw);
  const start = folded.search(/D[O0]MICILI[O0]/);
  if (start < 0) return new Set();
  const slice = folded.slice(start, start + 240);
  const end = slice.search(/\b(?:CURP|CLAVE|S[E3]CC(?:ION|I0N)?|SEXO)\b/);
  const zone = end > 0 ? slice.slice(0, end) : slice;
  return new Set(tokensCoyoacanEnTexto(zone));
}

function seccionFromDigitCrop(text: string, blocked: Set<string>): string[] {
  const four = seccionCandidatesInText(text, false).filter((value) =>
    isAllowedSeccion(value, blocked),
  );
  if (four.length) return four;
  return seccionCandidatesInText(text, true).filter((value) =>
    isAllowedSeccion(value, blocked),
  );
}

function extractSeccionFromLines(lines: string[], blocked: Set<string>): string {
  for (let i = 0; i < lines.length; i += 1) {
    if (!isSeccionHeader(lines[i])) continue;

    const sameLine = seccionToTheRight(lines[i], blocked);
    if (sameLine) return sameLine;

    for (let j = i + 1; j < Math.min(i + 4, lines.length); j += 1) {
      if (isDateOrCurpLine(lines[j]) || isNombreLabel(lines[j])) continue;
      if (isSeccionHeader(lines[j])) continue;
      const next = firstAllowedSeccion(seccionCandidatesInText(lines[j], true), blocked);
      if (next) return next;
    }
  }
  return "";
}

function collectSeccionReads(raw: string, blocked: Set<string>): {
  immediate: string[];
  labeled: string[];
  crops: string[];
} {
  const domicilio = domicilioFalseSecciones(raw);
  const immediate: string[] = [];
  const labeled: string[] = [];
  const crops: string[] = [];

  const take = (value: string, bucket: string[], ignoreDomicilio = false) => {
    if (!isAllowedSeccion(value, blocked)) return;
    if (!ignoreDomicilio && domicilio.has(value)) return;
    bucket.push(value);
  };

  const template = blockAfter(raw, "===ZONASECCION===");
  take(seccionAfterLabelInRaw(template, blocked), immediate, true);
  take(extractSeccionFromLines(linesOf(template), blocked), immediate, true);
  if (SECCION_LABEL.test(compact(template))) {
    for (const token of seccionFromDigitCrop(template, blocked)) {
      take(token, immediate, true);
    }
  }

  const fullText = raw.split("===NOMBRES===")[0] ?? raw;
  take(seccionAfterLabelInRaw(fullText, blocked), labeled, true);
  take(extractSeccionFromLines(linesOf(fullText), blocked), labeled, true);
  take(seccionFromCoyoacanGrid(fullText, blocked), labeled, true);

  for (const block of numberedBlocks(raw, "SECCION", 2)) {
    take(seccionAfterLabelInRaw(block, blocked), labeled);
    take(extractSeccionFromLines(linesOf(block), blocked), labeled);
    for (const token of seccionFromDigitCrop(block, blocked)) {
      take(token, crops);
    }
  }

  return { immediate, labeled, crops };
}

function extractSeccionFromRaw(raw: string, curp: string): string {
  const blocked = birthYearFromCurp(curp);
  const { immediate, labeled, crops } = collectSeccionReads(raw, blocked);
  const voted =
    confirmVotes(immediate, 1) ||
    confirmVotes(labeled, 2) ||
    confirmVotes(labeled, 1) ||
    confirmVotes(crops, 2) ||
    confirmVotes(crops, 1);
  const seccion = voted ? voted.padStart(4, "0") : "";
  return isFourDigitSeccion(seccion) ? seccion : "";
}

function curpNameScore(
  value: Pick<IneFields, "nombre" | "apellidoPaterno" | "apellidoMaterno">,
  curp: string,
): number {
  if (!curp) return scoreNames(value);
  return (
    (paternoFitsCurp(value.apellidoPaterno, curp) ? 5 : 0) +
    (maternoFitsCurp(value.apellidoMaterno, curp) ? 3 : 0) +
    (nombreFitsCurp(value.nombre, curp) ? 3 : 0)
  );
}

export function parseIneText(rawText: string): IneFields {
  const lines = linesOf(rawText);
  const curp = extractCurp(rawText, lines, "");
  const nameReads = collectNameReads(rawText, lines);
  const fromCurp = namesMatchingCurp(
    [
      ...lines,
      ...numberedBlocks(rawText, "NOMBRES", 2).flatMap((block) => linesOf(block)),
    ],
    curp,
  );
  const ranked = [...nameReads, fromCurp]
    .filter((item) => scoreNames(item) > 0 || curpNameScore(item, curp) > 0)
    .sort((a, b) => curpNameScore(b, curp) - curpNameScore(a, curp) || scoreNames(b) - scoreNames(a));
  const names = ranked[0]
    ? {
        apellidoPaterno:
          fromCurp.apellidoPaterno || ranked[0].apellidoPaterno,
        apellidoMaterno:
          fromCurp.apellidoMaterno || ranked[0].apellidoMaterno,
        nombre: fromCurp.nombre || ranked[0].nombre,
      }
    : confirmNameReads(nameReads);

  if (curp) {
    if (!paternoFitsCurp(names.apellidoPaterno, curp)) {
      names.apellidoPaterno = fromCurp.apellidoPaterno;
    }
    if (!maternoFitsCurp(names.apellidoMaterno, curp)) {
      names.apellidoMaterno = fromCurp.apellidoMaterno;
    }
    if (!nombreFitsCurp(names.nombre, curp)) {
      names.nombre = fromCurp.nombre;
    }
  }

  const claveBlocks = [...numberedBlocks(rawText, "CLAVE", 2), rawText];
  const claveElector = confirmClaveReads(
    claveBlocks.flatMap((block) => extractAllValidClaves(block, curp)),
    curp,
  );

  return {
    ...EMPTY_INE_FIELDS,
    ...names,
    curp,
    claveElector,
    seccion: extractSeccionFromRaw(rawText, curp),
  };
}

export function missingIneFields(fields: IneFields): Array<keyof IneFields> {
  return (Object.keys(fields) as Array<keyof IneFields>).filter(
    (key) => !fields[key],
  );
}

export function hasAnyIneData(fields: IneFields): boolean {
  return missingIneFields(fields).length < 6;
}
