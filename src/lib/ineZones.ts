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
  { left: 0.26, top: 0.06, right: 0.88, bottom: 0.5, scale: 3.2 },
  { left: 0.29, top: 0.1, right: 0.84, bottom: 0.46, scale: 3.6, contrast: true },
];

export const CURP_ZONES: IneZone[] = [
  { left: 0.24, top: 0.42, right: 0.84, bottom: 0.7, scale: 4.2 },
  { left: 0.28, top: 0.48, right: 0.8, bottom: 0.66, scale: 5, contrast: true },
];

export const SECCION_ZONES: IneZone[] = [
  { left: 0.58, top: 0.42, right: 0.99, bottom: 0.86, scale: 3.4 },
  { left: 0.66, top: 0.48, right: 0.99, bottom: 0.78, scale: 4.6, contrast: true },
];
