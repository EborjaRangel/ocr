import { alignIneBuffer, cropIneZones, flipAligned } from "./alignServer";
import { hasAnyIneData, parseIneText } from "./ineParser";
import { recognizeIneCrops } from "./ocrCrops";
import type { IneFields } from "./types";
import { EMPTY_INE_FIELDS } from "./types";

function scoreFields(fields: IneFields): number {
  let score = 0;
  if (fields.apellidoPaterno.length >= 2) score += 2;
  if (fields.apellidoMaterno.length >= 2) score += 2;
  if (fields.nombre.length >= 2) score += 2;
  if (fields.curp.length === 18) score += 5;
  if (/^(0\d{3}|5515)$/.test(fields.seccion)) score += 3;
  return score;
}

async function readAlignedCard(aligned: Buffer, includeFull: boolean): Promise<IneFields> {
  const crops = await cropIneZones(aligned);
  const text = await recognizeIneCrops({
    full: includeFull ? aligned : undefined,
    ...crops,
  });
  return { ...EMPTY_INE_FIELDS, ...parseIneText(text) };
}

export async function readInePhoto(input: Buffer): Promise<{
  fields: IneFields;
  foundData: boolean;
}> {
  const aligned = await alignIneBuffer(input);
  const first = await readAlignedCard(aligned, true);
  const firstScore = scoreFields(first);

  if (firstScore >= 12) {
    return { fields: first, foundData: true };
  }

  const flipped = await readAlignedCard(await flipAligned(aligned), false);
  const fields = scoreFields(flipped) > firstScore ? flipped : first;
  return {
    fields,
    foundData: hasAnyIneData(fields) || scoreFields(fields) > 0,
  };
}
