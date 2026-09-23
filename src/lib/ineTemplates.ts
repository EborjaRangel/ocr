import type { IneZone } from "./ineZones";

export type IneVersion = "c" | "d" | "cic";

export type IneTemplate = {
  version: IneVersion;
  names: IneZone[];
  curps: IneZone[];
  secciones: IneZone[];
};

export const INE_TEMPLATES: Record<IneVersion, IneTemplate> = {
  c: {
    version: "c",
    names: [
      { left: 0.24, top: 0.06, right: 0.8, bottom: 0.46, scale: 1.45 },
      { left: 0.28, top: 0.1, right: 0.76, bottom: 0.42, scale: 1.6, contrast: true },
    ],
    curps: [
      { left: 0.24, top: 0.4, right: 0.8, bottom: 0.66, scale: 1.55 },
      { left: 0.28, top: 0.46, right: 0.74, bottom: 0.64, scale: 1.8, contrast: true },
    ],
    secciones: [
      { left: 0.66, top: 0.44, right: 0.995, bottom: 0.8, scale: 1.7, contrast: true },
      { left: 0.7, top: 0.5, right: 0.995, bottom: 0.76, scale: 1.9, contrast: true },
    ],
  },
  d: {
    version: "d",
    names: [
      { left: 0.22, top: 0.05, right: 0.82, bottom: 0.48, scale: 1.45 },
      { left: 0.26, top: 0.09, right: 0.78, bottom: 0.44, scale: 1.6, contrast: true },
    ],
    curps: [
      { left: 0.22, top: 0.4, right: 0.82, bottom: 0.68, scale: 1.55 },
      { left: 0.26, top: 0.46, right: 0.76, bottom: 0.66, scale: 1.8, contrast: true },
    ],
    secciones: [
      { left: 0.68, top: 0.48, right: 0.995, bottom: 0.84, scale: 1.7, contrast: true },
      { left: 0.72, top: 0.54, right: 0.995, bottom: 0.8, scale: 1.95, contrast: true },
    ],
  },
  cic: {
    version: "cic",
    names: [
      { left: 0.2, top: 0.07, right: 0.7, bottom: 0.5, scale: 1.5 },
      { left: 0.24, top: 0.1, right: 0.66, bottom: 0.46, scale: 1.65, contrast: true },
    ],
    curps: [
      { left: 0.2, top: 0.4, right: 0.7, bottom: 0.68, scale: 1.55 },
      { left: 0.24, top: 0.46, right: 0.66, bottom: 0.64, scale: 1.8, contrast: true },
    ],
    secciones: [
      { left: 0.7, top: 0.52, right: 0.995, bottom: 0.88, scale: 1.75, contrast: true },
      { left: 0.74, top: 0.58, right: 0.995, bottom: 0.84, scale: 2, contrast: true },
    ],
  },
};

export function templateFor(version: IneVersion): IneTemplate {
  return INE_TEMPLATES[version];
}
