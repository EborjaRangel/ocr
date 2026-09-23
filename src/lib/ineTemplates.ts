import type { IneZone } from "./ineZones";

export type IneVersion = "c" | "d" | "cic";

export type IneTemplate = {
  version: IneVersion;
  names: IneZone[];
  curps: IneZone[];
  claves: IneZone[];
  secciones: IneZone[];
};

const NAME_ZONES: IneZone[] = [
  { left: 0.22, top: 0.08, right: 0.8, bottom: 0.46, scale: 1.55 },
  { left: 0.26, top: 0.12, right: 0.72, bottom: 0.4, scale: 1.75, contrast: true },
];

const CURP_ZONES: IneZone[] = [
  { left: 0.22, top: 0.38, right: 0.82, bottom: 0.7, scale: 1.55, denoise: true },
  { left: 0.26, top: 0.44, right: 0.76, bottom: 0.66, scale: 1.8, contrast: true },
];

const CLAVE_ZONES: IneZone[] = [
  { left: 0.2, top: 0.5, right: 0.78, bottom: 0.84, scale: 1.55, denoise: true },
  { left: 0.24, top: 0.56, right: 0.72, bottom: 0.8, scale: 1.8, contrast: true },
];

export const INE_TEMPLATES: Record<IneVersion, IneTemplate> = {
  c: {
    version: "c",
    names: NAME_ZONES,
    curps: CURP_ZONES,
    claves: CLAVE_ZONES,
    secciones: [
      { left: 0.58, top: 0.4, right: 0.995, bottom: 0.88, scale: 1.55, denoise: true, contrast: true },
      { left: 0.68, top: 0.46, right: 0.995, bottom: 0.8, scale: 1.85, contrast: true },
    ],
  },
  d: {
    version: "d",
    names: NAME_ZONES,
    curps: CURP_ZONES,
    claves: CLAVE_ZONES,
    secciones: [
      { left: 0.58, top: 0.42, right: 0.995, bottom: 0.9, scale: 1.55, denoise: true, contrast: true },
      { left: 0.7, top: 0.5, right: 0.995, bottom: 0.84, scale: 1.85, contrast: true },
    ],
  },
  cic: {
    version: "cic",
    names: NAME_ZONES,
    curps: CURP_ZONES,
    claves: CLAVE_ZONES,
    secciones: [
      { left: 0.6, top: 0.48, right: 0.995, bottom: 0.92, scale: 1.55, denoise: true, contrast: true },
      { left: 0.72, top: 0.54, right: 0.995, bottom: 0.88, scale: 1.9, contrast: true },
    ],
  },
};

export function templateFor(version: IneVersion): IneTemplate {
  return INE_TEMPLATES[version];
}
