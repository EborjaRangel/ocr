export type IneZone = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  scale: number;
  contrast?: boolean;
};

export const OCR_READS = 2;

export const NAME_ZONES: IneZone[] = [
  { left: 0.22, top: 0.05, right: 0.82, bottom: 0.48, scale: 1.45 },
  { left: 0.26, top: 0.09, right: 0.78, bottom: 0.44, scale: 1.6, contrast: true },
];

export const CURP_ZONES: IneZone[] = [
  { left: 0.22, top: 0.4, right: 0.82, bottom: 0.68, scale: 1.55 },
  { left: 0.26, top: 0.46, right: 0.76, bottom: 0.66, scale: 1.8, contrast: true },
];

export const SECCION_ZONES: IneZone[] = [
  { left: 0.68, top: 0.48, right: 0.995, bottom: 0.84, scale: 1.7, contrast: true },
  { left: 0.72, top: 0.54, right: 0.995, bottom: 0.8, scale: 1.95, contrast: true },
];
