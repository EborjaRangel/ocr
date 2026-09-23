import sharp from "sharp";
import { PSM } from "tesseract.js";
import { cropPixelBox } from "./alignServer";
import { recognizeImageWords } from "./ocrCrops";
import { seccionBesideLabel, seccionTargetBoxes, type OcrWord } from "./seccionFromWords";
import { isFourDigitSeccion, pickPreferredSeccion, validateSeccionToken } from "./validateSeccion";

function tokensFromText(text: string, nearLabel: boolean): string[] {
  const found: string[] = [];
  for (const match of text.toUpperCase().matchAll(/[OQD0-9]{3,5}/g)) {
    const value = validateSeccionToken(match[0], nearLabel);
    if (value) found.push(value);
  }
  return found;
}

function tokensFromWords(words: OcrWord[], nearLabel: boolean): string[] {
  return words
    .map((word) => validateSeccionToken(word.text, nearLabel))
    .filter(isFourDigitSeccion);
}

export async function readSeccionFromRegion(region: Buffer): Promise<{
  value: string;
  zoneHits: string[];
  otherHits: string[];
  words: OcrWord[];
}> {
  const sparse = await recognizeImageWords(region, PSM.SPARSE_TEXT);
  const beside = seccionBesideLabel(sparse.words);
  const labeled = validateSeccionToken(beside, true);
  const zoneHits = [
    labeled,
    ...tokensFromWords(sparse.words, Boolean(labeled || beside)),
    ...tokensFromText(sparse.text, true),
  ].filter(isFourDigitSeccion);

  const meta = await sharp(region).metadata();
  const boxes = seccionTargetBoxes(sparse.words, meta.width ?? 960, meta.height ?? 480);
  const otherHits: string[] = [];
  for (const box of boxes.slice(0, 2)) {
    const tight = await cropPixelBox(region, box, true);
    const tightRead = await recognizeImageWords(tight, PSM.SINGLE_BLOCK);
    otherHits.push(...tokensFromText(tightRead.text, true));
  }

  return {
    value: pickPreferredSeccion(zoneHits, otherHits),
    zoneHits,
    otherHits,
    words: sparse.words,
  };
}
