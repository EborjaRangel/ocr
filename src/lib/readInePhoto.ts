import {
  alignIneBuffer,
  cropIneZones,
  enhanceForOcr,
  orientationTurns,
  prepareIneInput,
} from "./alignServer";
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

function pickField(current: string, next: string): string {
  if (!current) return next;
  if (!next) return current;
  return current;
}

function mergeFields(current: IneFields, next: IneFields): IneFields {
  if (scoreFields(next) > scoreFields(current) && next.curp) {
    return {
      nombre: next.nombre || current.nombre,
      apellidoPaterno: next.apellidoPaterno || current.apellidoPaterno,
      apellidoMaterno: next.apellidoMaterno || current.apellidoMaterno,
      curp: next.curp,
      seccion: next.seccion || current.seccion,
    };
  }
  return {
    nombre: pickField(current.nombre, next.nombre),
    apellidoPaterno: pickField(current.apellidoPaterno, next.apellidoPaterno),
    apellidoMaterno: pickField(current.apellidoMaterno, next.apellidoMaterno),
    curp: current.curp || next.curp,
    seccion: current.seccion || next.seccion,
  };
}

async function readFull(aligned: Buffer): Promise<IneFields> {
  const enhanced = await enhanceForOcr(aligned);
  const text = await recognizeIneCrops({
    full: enhanced,
    names: [],
    curps: [],
    secciones: [],
  });
  return { ...EMPTY_INE_FIELDS, ...parseIneText(text) };
}

async function readCrops(aligned: Buffer): Promise<IneFields> {
  const enhanced = await enhanceForOcr(aligned);
  const crops = await cropIneZones(enhanced);
  const text = await recognizeIneCrops(crops);
  return { ...EMPTY_INE_FIELDS, ...parseIneText(text) };
}

export async function readInePhoto(input: Buffer): Promise<{
  fields: IneFields;
  foundData: boolean;
}> {
  const prepared = await prepareIneInput(input);
  const turns = await orientationTurns(prepared);
  let best = { ...EMPTY_INE_FIELDS };
  let bestAligned: Buffer | null = null;
  let bestAlignedScore = -1;

  for (let i = 0; i < turns.length; i += 1) {
    const aligned = await alignIneBuffer(prepared, turns[i]);
    const fields = await readFull(aligned);
    const turnScore = scoreFields(fields);
    best = mergeFields(best, fields);
    if (turnScore > bestAlignedScore) {
      bestAligned = aligned;
      bestAlignedScore = turnScore;
    }
    console.log("ChatCoyo OCR full", {
      turn: turns[i],
      score: scoreFields(best),
      curp: Boolean(best.curp),
      seccion: Boolean(best.seccion),
    });
    if (scoreFields(best) >= 12) break;
    if (i === 1 && scoreFields(best) > 0) break;
  }

  if (scoreFields(best) < 12 && bestAligned) {
    const cropped = await readCrops(bestAligned);
    best = mergeFields(best, cropped);
    console.log("ChatCoyo OCR crops", {
      score: scoreFields(best),
      curp: Boolean(best.curp),
      seccion: Boolean(best.seccion),
    });
  }

  return {
    fields: best,
    foundData: hasAnyIneData(best) || scoreFields(best) > 0,
  };
}
