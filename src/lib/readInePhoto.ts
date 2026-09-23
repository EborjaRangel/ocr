import {
  alignIneBuffer,
  cropHeaderStrip,
  cropIneZones,
  orientationTurns,
  prepareIneInput,
} from "./alignServer";
import { detectIneVersion } from "./detectIneVersion";
import { hasAnyIneData, parseIneText } from "./ineParser";
import { templateFor } from "./ineTemplates";
import { scoreInstitutoHeader } from "./institutoHeader";
import { recognizeImageWords, recognizeIneCrops } from "./ocrCrops";
import { readSeccionFromRegion } from "./readSeccion";
import type { IneFields } from "./types";
import { EMPTY_INE_FIELDS } from "./types";
import { blockedSeccionFromCurp, isFourDigitSeccion } from "./validateSeccion";

function scoreFields(fields: IneFields): number {
  let score = 0;
  if (fields.apellidoPaterno.length >= 2) score += 2;
  if (fields.apellidoMaterno.length >= 2) score += 2;
  if (fields.nombre.length >= 2) score += 2;
  if (fields.curp.length === 18) score += 5;
  if (isFourDigitSeccion(fields.seccion)) score += 3;
  return score;
}

async function headerScore(aligned: Buffer): Promise<number> {
  const strip = await cropHeaderStrip(aligned);
  const read = await recognizeImageWords(strip);
  return scoreInstitutoHeader(read.text);
}

async function uprightCard(prepared: Buffer): Promise<Buffer> {
  const turns = await orientationTurns(prepared);
  let best = await alignIneBuffer(prepared, turns[0] ?? 0);
  let bestScore = await headerScore(best);

  for (const turn of turns.slice(1, 2)) {
    if (bestScore >= 20) break;
    const aligned = await alignIneBuffer(prepared, turn);
    const score = await headerScore(aligned);
    if (score > bestScore) {
      best = aligned;
      bestScore = score;
    }
  }

  return best;
}

async function readByTemplate(aligned: Buffer): Promise<IneFields> {
  const version = await detectIneVersion(aligned);
  const template = templateFor(version);
  const crops = await cropIneZones(aligned, template);
  const text = await recognizeIneCrops({
    names: crops.names,
    curps: crops.curps,
    secciones: [],
    seccionTemplate: crops.secciones[0],
  });
  const parsed = parseIneText(text);
  const blocked = blockedSeccionFromCurp(parsed.curp);

  let seccion = isFourDigitSeccion(parsed.seccion) && !blocked.has(parsed.seccion)
    ? parsed.seccion
    : "";

  if (!seccion && crops.secciones[0]) {
    const fromZone = await readSeccionFromRegion(crops.secciones[0], blocked);
    seccion = fromZone.value;
  }
  if (!seccion && crops.secciones[1]) {
    const fromZone = await readSeccionFromRegion(crops.secciones[1], blocked);
    seccion = fromZone.value;
  }

  console.log("ChatCoyo INE", {
    version,
    curp: Boolean(parsed.curp),
    names: [parsed.apellidoPaterno, parsed.apellidoMaterno, parsed.nombre].filter(Boolean).length,
    seccion: Boolean(seccion),
  });

  return {
    ...EMPTY_INE_FIELDS,
    ...parsed,
    seccion,
  };
}

export async function readInePhoto(input: Buffer): Promise<{
  fields: IneFields;
  foundData: boolean;
}> {
  const prepared = await prepareIneInput(input);
  const aligned = await uprightCard(prepared);
  const fields = await readByTemplate(aligned);

  if (!isFourDigitSeccion(fields.seccion)) {
    fields.seccion = "";
  }

  return {
    fields,
    foundData: hasAnyIneData(fields) || scoreFields(fields) > 0,
  };
}
