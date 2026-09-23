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
  { left: 0.26, top: 0.06, right: 0.88, bottom: 0.5, scale: 1.35 },
  { left: 0.29, top: 0.1, right: 0.84, bottom: 0.46, scale: 1.5, contrast: true },
];

export const CURP_ZONES: IneZone[] = [
  { left: 0.24, top: 0.42, right: 0.84, bottom: 0.7, scale: 1.5 },
  { left: 0.28, top: 0.48, right: 0.8, bottom: 0.66, scale: 1.7, contrast: true },
];

export const SECCION_ZONES: IneZone[] = [
  { left: 0.58, top: 0.42, right: 0.99, bottom: 0.86, scale: 1.4 },
  { left: 0.66, top: 0.48, right: 0.99, bottom: 0.78, scale: 1.6, contrast: true },
];
