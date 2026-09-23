export type IneZone = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  scale: number;
  contrast?: boolean;
  denoise?: boolean;
};

export const OCR_READS = 2;

export const NAME_ZONES: IneZone[] = [
  { left: 0.22, top: 0.08, right: 0.8, bottom: 0.46, scale: 1.55 },
  { left: 0.26, top: 0.12, right: 0.72, bottom: 0.4, scale: 1.75, contrast: true },
];

export const CURP_ZONES: IneZone[] = [
  { left: 0.22, top: 0.38, right: 0.82, bottom: 0.7, scale: 1.55, denoise: true },
  { left: 0.26, top: 0.44, right: 0.76, bottom: 0.66, scale: 1.8, contrast: true },
];

export const SECCION_ZONES: IneZone[] = [
  { left: 0.58, top: 0.42, right: 0.995, bottom: 0.9, scale: 1.55, denoise: true, contrast: true },
  { left: 0.7, top: 0.5, right: 0.995, bottom: 0.84, scale: 1.85, contrast: true },
];
