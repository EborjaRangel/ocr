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
  { left: 0.2, top: 0.04, right: 0.94, bottom: 0.54, scale: 1.45 },
  { left: 0.26, top: 0.08, right: 0.88, bottom: 0.48, scale: 1.6, contrast: true },
];

export const CURP_ZONES: IneZone[] = [
  { left: 0.2, top: 0.36, right: 0.9, bottom: 0.74, scale: 1.55 },
  { left: 0.26, top: 0.44, right: 0.84, bottom: 0.68, scale: 1.8, contrast: true },
];

export const SECCION_ZONES: IneZone[] = [
  { left: 0.5, top: 0.36, right: 0.995, bottom: 0.9, scale: 1.5 },
  { left: 0.62, top: 0.44, right: 0.995, bottom: 0.82, scale: 1.75, contrast: true },
];
