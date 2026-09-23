import { alignIneBuffer, cropIneZones } from "./alignServer";
import { hasAnyIneData, parseIneText } from "./ineParser";
import { recognizeIneCrops } from "./ocrCrops";
import type { IneFields } from "./types";
import { EMPTY_INE_FIELDS } from "./types";

export async function readInePhoto(input: Buffer): Promise<{
  fields: IneFields;
  foundData: boolean;
}> {
  const aligned = await alignIneBuffer(input);
  const crops = await cropIneZones(aligned);
  const text = await recognizeIneCrops(crops);
  const fields = { ...EMPTY_INE_FIELDS, ...parseIneText(text) };
  return {
    fields,
    foundData: hasAnyIneData(fields) || text.trim().length > 12,
  };
}
