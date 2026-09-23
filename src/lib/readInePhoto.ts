import { alignIneBuffer, cropIneZones, orientationTurns } from "./alignServer";
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
  const turns = await orientationTurns(input);
  let best = { ...EMPTY_INE_FIELDS };
  let bestScore = -1;

  for (let i = 0; i < turns.length; i += 1) {
    const aligned = await alignIneBuffer(input, turns[i]);
    const fields = await readAlignedCard(aligned, i === 0);
    const score = scoreFields(fields);
    if (score > bestScore) {
      best = fields;
      bestScore = score;
    }
    if (bestScore >= 12) break;
  }

  return {
    fields: best,
    foundData: hasAnyIneData(best) || bestScore > 0,
  };
}
