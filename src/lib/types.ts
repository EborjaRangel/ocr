export type IneFields = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  curp: string;
  claveElector: string;
  seccion: string;
};

export type ChatCoyoFields = IneFields & {
  celular: string;
  correo: string;
  diasVividos: string;
  anios: string;
  meses: string;
  signoZodiacal: string;
};

export type IneRecord = ChatCoyoFields & {
  fecha: string;
};

export const EMPTY_INE_FIELDS: IneFields = {
  nombre: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  curp: "",
  claveElector: "",
  seccion: "",
};

export const EMPTY_CHAT_FIELDS: ChatCoyoFields = {
  ...EMPTY_INE_FIELDS,
  celular: "",
  correo: "",
  diasVividos: "",
  anios: "",
  meses: "",
  signoZodiacal: "",
};

export type OcrProgress = {
  status: string;
  progress: number;
};
