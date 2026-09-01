export type IneFields = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  curp: string;
  seccion: string;
};

export type IneRecord = IneFields & {
  fecha: string;
};

export const EMPTY_INE_FIELDS: IneFields = {
  nombre: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  curp: "",
  seccion: "",
};

export type OcrProgress = {
  status: string;
  progress: number;
};
