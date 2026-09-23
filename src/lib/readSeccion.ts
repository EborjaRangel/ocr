import sharp from "sharp";
import { PSM } from "tesseract.js";
import { cropPixelBox } from "./alignServer";
import { recognizeImageWords } from "./ocrCrops";
import { seccionBesideLabel, seccionTargetBoxes, type OcrWord } from "./seccionFromWords";
import { isFourDigitSeccion, pickPreferredSeccion, validateSeccionToken } from "./validateSeccion";

function hasSeccionLabel(text: string, words: OcrWord[]): boolean {
  if (words.some((word) => /S[E3]CC/i.test(word.text))) return true;
  return /S[E3]CC(?:ION|I0N|JON|10N|1ON)/i.test(text);
}

function tokensFromText(text: string, nearLabel: boolean, blocked: Set<string>): string[] {
  const found: string[] = [];
  for (const match of text.toUpperCase().matchAll(/[OQD0-9]{3,5}/g)) {
    const value = validateSeccionToken(match[0], nearLabel);
    if (value && !blocked.has(value)) found.push(value);
  }
  return found;
}

function tokensFromWords(words: OcrWord[], nearLabel: boolean, blocked: Set<string>): string[] {
  return words
    .map((word) => validateSeccionToken(word.text, nearLabel))
    .filter((value) => isFourDigitSeccion(value) && !blocked.has(value));
}

export async function readSeccionFromRegion(
  region: Buffer,
  blocked = new Set<string>(),
): Promise<{
  value: string;
  zoneHits: string[];
  otherHits: string[];
  words: OcrWord[];
}> {
  const sparse = await recognizeImageWords(region, PSM.SPARSE_TEXT);
  const labeled = hasSeccionLabel(sparse.text, sparse.words);
  const beside = validateSeccionToken(seccionBesideLabel(sparse.words), true);
  const zoneHits = [beside, ...tokensFromWords(sparse.words, labeled, blocked)].filter(
    (value) => isFourDigitSeccion(value) && !blocked.has(value),
  );

  const otherHits: string[] = [];
  if (labeled) {
    zoneHits.push(...tokensFromText(sparse.text, true, blocked));
    const meta = await sharp(region).metadata();
    const boxes = seccionTargetBoxes(sparse.words, meta.width ?? 960, meta.height ?? 480);
    for (const box of boxes.slice(0, 2)) {
      const tight = await cropPixelBox(region, box, true);
      const tightRead = await recognizeImageWords(tight, PSM.SINGLE_BLOCK);
      otherHits.push(...tokensFromText(tightRead.text, true, blocked));
    }
  }

  return {
    value: pickPreferredSeccion(zoneHits, otherHits),
    zoneHits,
    otherHits,
    words: sparse.words,
  };
}
