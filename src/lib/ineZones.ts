export type IneZone = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  scale: number;
  contrast?: boolean;
};

export const NAME_ZONES: IneZone[] = [
  { left: 0.26, top: 0.06, right: 0.88, bottom: 0.5, scale: 3.2 },
  { left: 0.29, top: 0.1, right: 0.84, bottom: 0.46, scale: 3.6, contrast: true },
  { left: 0.24, top: 0.08, right: 0.86, bottom: 0.52, scale: 2.8 },
  { left: 0.3, top: 0.14, right: 0.8, bottom: 0.44, scale: 4 },
  { left: 0.27, top: 0.18, right: 0.82, bottom: 0.42, scale: 4.2, contrast: true },
];

export const CURP_ZONES: IneZone[] = [
  { left: 0.24, top: 0.42, right: 0.84, bottom: 0.7, scale: 4.2 },
  { left: 0.28, top: 0.48, right: 0.8, bottom: 0.66, scale: 5, contrast: true },
  { left: 0.2, top: 0.44, right: 0.78, bottom: 0.72, scale: 3.6 },
  { left: 0.08, top: 0.46, right: 0.74, bottom: 0.68, scale: 4.4, contrast: true },
  { left: 0.3, top: 0.5, right: 0.76, bottom: 0.64, scale: 5.2 },
];

export const SECCION_ZONES: IneZone[] = [
  { left: 0.58, top: 0.42, right: 0.99, bottom: 0.84, scale: 3.4 },
  { left: 0.68, top: 0.46, right: 0.99, bottom: 0.7, scale: 4.6, contrast: true },
  { left: 0.6, top: 0.52, right: 0.95, bottom: 0.88, scale: 3.8 },
  { left: 0.72, top: 0.48, right: 0.99, bottom: 0.66, scale: 5.2 },
  { left: 0.62, top: 0.56, right: 0.96, bottom: 0.82, scale: 4.2, contrast: true },
];
