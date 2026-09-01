import { isCoyoacanSeccion, normalizeSeccionToken } from "./coyoacanSeccion";

export type OcrWord = {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type PixelBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function foldToken(text: string): string {
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function isSeccionLabelWord(text: string): boolean {
  const value = foldToken(text);
  return (
    /S[E3]CC(?:ION|I0N|JON|10N|1ON)?$/.test(value) &&
    value.length >= 4 &&
    value.length <= 10
  );
}

function asSeccionDigits(text: string): string {
  const value = normalizeSeccionToken(text);
  if (!value || !isCoyoacanSeccion(value)) return "";
  const year = Number(value);
  if (year >= 1900 && year <= 2099) return "";
  return value;
}

function clampBox(
  x: number,
  y: number,
  width: number,
  height: number,
  imageW: number,
  imageH: number,
): PixelBox {
  const left = Math.max(0, x);
  const top = Math.max(0, y);
  return {
    x: left,
    y: top,
    width: Math.max(8, Math.min(imageW - left, width)),
    height: Math.max(8, Math.min(imageH - top, height)),
  };
}

export function seccionBesideLabel(words: OcrWord[]): string {
  const labels = words.filter((word) => isSeccionLabelWord(word.text));

  for (const label of labels) {
    const height = Math.max(8, label.bbox.y1 - label.bbox.y0);
    const width = Math.max(12, label.bbox.x1 - label.bbox.x0);

    const right = words
      .filter((word) => {
        if (word === label) return false;
        const midY = (word.bbox.y0 + word.bbox.y1) / 2;
        const sameRow =
          midY >= label.bbox.y0 - height * 0.5 && midY <= label.bbox.y1 + height * 0.5;
        const toRight =
          word.bbox.x0 >= label.bbox.x1 - width * 0.15 &&
          word.bbox.x0 <= label.bbox.x1 + width * 5;
        return sameRow && toRight;
      })
      .sort((a, b) => a.bbox.x0 - b.bbox.x0);

    const rightValue = right.map((word) => asSeccionDigits(word.text)).find(Boolean);
    if (rightValue) return rightValue;

    const below = words
      .filter((word) => {
        if (word === label) return false;
        const midX = (word.bbox.x0 + word.bbox.x1) / 2;
        const aligned =
          midX >= label.bbox.x0 - width * 0.35 && midX <= label.bbox.x1 + width * 0.45;
        const under =
          word.bbox.y0 >= label.bbox.y1 - height * 0.2 &&
          word.bbox.y0 <= label.bbox.y1 + height * 3.2;
        return aligned && under;
      })
      .sort((a, b) => a.bbox.y0 - b.bbox.y0);

    const belowValue = below.map((word) => asSeccionDigits(word.text)).find(Boolean);
    if (belowValue) return belowValue;
  }

  return "";
}

export function seccionTargetBoxes(
  words: OcrWord[],
  imageW: number,
  imageH: number,
): PixelBox[] {
  const label = words.find((word) => isSeccionLabelWord(word.text));
  if (!label) return [];

  const width = Math.max(16, label.bbox.x1 - label.bbox.x0);
  const height = Math.max(10, label.bbox.y1 - label.bbox.y0);

  return [
    clampBox(label.bbox.x1, label.bbox.y0 - height * 0.45, width * 4.8, height * 2.1, imageW, imageH),
    clampBox(
      label.bbox.x1 - width * 0.1,
      label.bbox.y0 - height * 0.7,
      width * 5.6,
      height * 2.5,
      imageW,
      imageH,
    ),
    clampBox(label.bbox.x0 - width * 0.15, label.bbox.y1, width * 2.4, height * 3.6, imageW, imageH),
    clampBox(label.bbox.x1, label.bbox.y0, width * 3.2, height * 3.2, imageW, imageH),
    clampBox(
      label.bbox.x1 + width * 0.05,
      label.bbox.y0 - height * 0.2,
      width * 2.8,
      height * 1.8,
      imageW,
      imageH,
    ),
  ];
}
