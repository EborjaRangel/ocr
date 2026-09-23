import {
  alignIneBuffer,
  cropIneZones,
  orientationTurns,
  prepareIneInput,
} from "./alignServer";
import { detectIneVersion } from "./detectIneVersion";
import { hasAnyIneData, parseIneText } from "./ineParser";
import { templateFor } from "./ineTemplates";
import { recognizeIneCrops } from "./ocrCrops";
import { readSeccionFromRegion } from "./readSeccion";
import type { IneFields } from "./types";
import { EMPTY_INE_FIELDS } from "./types";
import { blockedSeccionFromCurp, isFourDigitSeccion } from "./validateSeccion";
import { hasVisionOcr, readIneWithVision } from "./visionIne";

function scoreFields(fields: IneFields): number {
  let score = 0;
  if (fields.apellidoPaterno.length >= 2) score += 2;
  if (fields.apellidoMaterno.length >= 2) score += 2;
  if (fields.nombre.length >= 2) score += 2;
  if (fields.curp.length === 18) score += 5;
  if (fields.claveElector.length === 18) score += 4;
  if (isFourDigitSeccion(fields.seccion)) score += 3;
  return score;
}

async function readByTemplate(aligned: Buffer): Promise<IneFields> {
  const version = await detectIneVersion(aligned);
  const template = templateFor(version);
  const crops = await cropIneZones(aligned, template);
  const text = await recognizeIneCrops({
    names: crops.names,
    curps: crops.curps,
    claves: crops.claves,
    secciones: [],
    seccionTemplate: crops.secciones[0],
  });
  const parsed = parseIneText(text);
  const blocked = blockedSeccionFromCurp(parsed.curp);

  let seccion = isFourDigitSeccion(parsed.seccion) && !blocked.has(parsed.seccion)
    ? parsed.seccion
    : "";

  if (!seccion && crops.secciones[0]) {
    seccion = (await readSeccionFromRegion(crops.secciones[0], blocked)).value;
  }

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
  if (hasVisionOcr()) {
    const fields = await readIneWithVision(input);
    console.log("ChatCoyo INE vision", {
      curp: Boolean(fields.curp),
      clave: Boolean(fields.claveElector),
      names: [fields.apellidoPaterno, fields.apellidoMaterno, fields.nombre].filter(Boolean).length,
      seccion: Boolean(fields.seccion),
    });
    return {
      fields,
      foundData: hasAnyIneData(fields) || scoreFields(fields) > 0,
    };
  }

  const prepared = await prepareIneInput(input);
  const turns = await orientationTurns(prepared);
  const aligned = await alignIneBuffer(prepared, turns[0] ?? 0);
  const fields = await readByTemplate(aligned);
  if (!isFourDigitSeccion(fields.seccion)) fields.seccion = "";

  return {
    fields,
    foundData: hasAnyIneData(fields) || scoreFields(fields) > 0,
  };
}
