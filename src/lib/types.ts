export type IneFields = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  curp: string;
  seccion: string;
};

export type ChatCoyoFields = IneFields & {
  celular: string;
  correo: string;
};

export type IneRecord = ChatCoyoFields & {
  fecha: string;
};

export const EMPTY_INE_FIELDS: IneFields = {
  nombre: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  curp: "",
  seccion: "",
};

export const EMPTY_CHAT_FIELDS: ChatCoyoFields = {
  ...EMPTY_INE_FIELDS,
  celular: "",
  correo: "",
};

export type OcrProgress = {
  status: string;
  progress: number;
};
