import { CURP_REGEX } from "./validation";

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

function correctByPosition(raw: string): string {
  return raw
    .toUpperCase()
    .split("")
    .map((char, index) => {
      if (index >= 15) return char;
      if (index <= 3 || (index >= 10 && index <= 14)) {
        return TO_LETTER[char] ?? char;
      }
      if (index >= 4 && index <= 9) {
        return char === "Q" ? char : (TO_DIGIT[char] ?? char);
      }
      return char;
    })
    .join("");
}

function compactAlnum(value: string): string {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

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

const LETTER_OCR: Record<string, string[]> = {
  O: ["0", "Q", "D"],
  I: ["1", "L"],
  B: ["8"],
  S: ["5"],
  G: ["6"],
  Z: ["2"],
};

function looksLikeCurp(value: string): boolean {
  return value.length === 18 && (CURP_REGEX.test(value) || /^[A-Z]{4}\d{6}[HMX][A-Z0-9]{7}$/.test(value));
}

export function prefixesFromPaterno(apellidoPaterno: string): string[] {
  const words = apellidoPaterno
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ñ/g, "X")
    .split(/[^A-Z]+/)
    .filter((word) => word && !SURNAME_PARTICLES.has(word));
  const letters = (words[0] ?? "").replace(/[^A-Z]/g, "");
  if (!letters) return [];
  if (letters.length === 1) return [letters[0]];

  const twoLetters = letters.slice(0, 2);
  const firstVowel = letters.slice(1).match(/[AEIOU]/)?.[0] ?? "X";
  const official = `${letters[0]}${firstVowel}`;
  const prefixes = [twoLetters];
  if (official !== twoLetters) prefixes.push(official);
  prefixes.push(letters[0]);
  return prefixes;
}

function prefixMatches(got: string, expected: string): boolean {
  if (got.length < expected.length) return false;
  for (let i = 0; i < expected.length; i += 1) {
    const actual = got[i];
    const want = expected[i];
    if (actual === want) continue;
    if (LETTER_OCR[want]?.includes(actual)) continue;
    return false;
  }
  return true;
}

function matchesAnyPrefix(value: string, prefixes: string[]): boolean {
  if (prefixes.length === 0) return true;
  return prefixes.some((prefix) => prefixMatches(value, prefix));
}

function curpCheckDigit(first17: string): string {
  const dictionary = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    const index = dictionary.indexOf(first17[i]);
    if (index < 0) return "";
    sum += index * (18 - i);
  }
  const digit = 10 - (sum % 10);
  return digit === 10 ? "0" : String(digit);
}

function withOfficialCheckDigit(value: string): string {
  if (value.length < 17) return value;
  const prefix = value.slice(0, 17);
  const digit = curpCheckDigit(prefix);
  if (!digit) return value;
  return `${prefix}${digit}`;
}

function keepLastThree(value: string): string {
  if (value.length < 17) return "";
  if (value.length === 17) {
    const filled = withOfficialCheckDigit(value);
    return looksLikeCurp(filled) ? filled : "";
  }
  const curp18 = value.slice(0, 18).toUpperCase();
  return looksLikeCurp(curp18) ? curp18 : "";
}

function acceptCurp(value: string, prefixes: string[]): string {
  const raw = value.slice(0, 18).toUpperCase();
  const fromRaw = keepLastThree(raw);
  if (fromRaw && matchesAnyPrefix(fromRaw, prefixes)) return fromRaw;

  const correctedHead = correctByPosition(raw);
  const merged = `${correctedHead.slice(0, 15)}${raw.slice(15)}`;
  const fromMerged = keepLastThree(merged);
  if (fromMerged && matchesAnyPrefix(fromMerged, prefixes)) return fromMerged;
  return "";
}

function findCurpInCompact(compact: string, prefixes: string[]): string {
  if (prefixes.length > 0) {
    for (let i = 0; i <= compact.length - 18; i += 1) {
      if (!matchesAnyPrefix(compact.slice(i, i + 2), prefixes)) continue;
      const found = acceptCurp(compact.slice(i, i + 18), prefixes);
      if (found) return found;
    }
    if (compact.length >= 17 && compact.length < 18) {
      const found = acceptCurp(`${compact}0`, prefixes);
      if (found) return found;
    }
    return "";
  }

  for (let i = 0; i <= compact.length - 18; i += 1) {
    const found = acceptCurp(compact.slice(i, i + 18), prefixes);
    if (found) return found;
  }
  if (compact.length === 17) return acceptCurp(`${compact}0`, prefixes);
  return "";
}

export function extractValidCurp(raw: string, apellidoPaterno = ""): string {
  const prefixes = prefixesFromPaterno(apellidoPaterno);
  const compact = compactAlnum(raw);

  const labeled = raw.toUpperCase().match(/CURP[\s:.-]*([A-Z0-9][A-Z0-9\s]{15,40})/);
  if (labeled?.[1]) {
    const fromLabeled = findCurpInCompact(compactAlnum(labeled[1]), prefixes);
    if (fromLabeled) return fromLabeled;
  }

  return findCurpInCompact(compact, prefixes);
}

function tally(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function winnerWithMin(counts: Map<string, number>, minVotes: number): string {
  let winner = "";
  let best = 0;
  for (const [value, count] of counts) {
    if (count > best) {
      winner = value;
      best = count;
    }
  }
  return best >= minVotes ? winner : "";
}

export function extractAllValidCurps(raw: string, apellidoPaterno = ""): string[] {
  const prefixes = prefixesFromPaterno(apellidoPaterno);
  const compact = compactAlnum(raw);
  const found = new Set<string>();

  const labeled = raw.toUpperCase().match(/CURP[\s:.-]*([A-Z0-9][A-Z0-9\s]{15,40})/);
  const glued = raw.toUpperCase().match(/CURP[\s:.-]*([A-Z0-9]{18})/);
  const texts = [
    labeled?.[1] ? compactAlnum(labeled[1]) : "",
    glued?.[1] ?? "",
    compact,
  ].filter(Boolean);

  for (const text of texts) {
    for (let i = 0; i <= text.length - 18; i += 1) {
      if (prefixes.length && !matchesAnyPrefix(text.slice(i, i + 2), prefixes)) continue;
      const curp = acceptCurp(text.slice(i, i + 18), prefixes);
      if (curp && curp.length === 18) found.add(curp);
    }
  }
  return [...found];
}

export function confirmCurpReads(
  reads: string[],
  apellidoPaterno = "",
): string {
  const prefixes = prefixesFromPaterno(apellidoPaterno);
  const twoLetter = prefixes.filter((prefix) => prefix.length >= 2);
  const eighteen = reads.filter((value) => value.length === 18 && looksLikeCurp(value));
  const matching = eighteen.filter((value) => matchesAnyPrefix(value, prefixes));
  const strong = matching.filter((value) =>
    twoLetter.some((prefix) => prefixMatches(value, prefix)),
  );
  const valid = strong.length ? strong : matching.length ? matching : eighteen;
  if (valid.length === 0) return "";
  if (valid.length === 1) return valid[0];

  const fullAgreement =
    winnerWithMin(tally(valid), 3) || winnerWithMin(tally(valid), 2);
  if (fullAgreement) return fullAgreement;

  const head17 =
    winnerWithMin(tally(valid.map((value) => value.slice(0, 17))), 3) ||
    winnerWithMin(tally(valid.map((value) => value.slice(0, 17))), 2);
  if (head17) {
    const lastVotes = valid
      .filter((value) => value.startsWith(head17))
      .map((value) => value[17] ?? "");
    const lastChar = winnerWithMin(tally(lastVotes), 2);
    if (lastChar) return `${head17}${lastChar}`;
    return withOfficialCheckDigit(head17);
  }

  let merged = "";
  for (let i = 0; i < 18; i += 1) {
    const minVotes = i === 17 ? 2 : 1;
    const char = winnerWithMin(
      tally(valid.map((value) => value[i] ?? "")),
      minVotes,
    );
    if (!char && i === 17) {
      merged = withOfficialCheckDigit(merged);
      break;
    }
    merged += char || valid[0][i];
  }
  if (looksLikeCurp(merged) && matchesAnyPrefix(merged, prefixes)) return merged;
  return valid[0] ?? "";
}
