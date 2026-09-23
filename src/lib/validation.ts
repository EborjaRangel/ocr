import * as Yup from "yup";
import type { ChatCoyoFields, IneFields } from "./types";

export const CURP_REGEX = /^[A-Z]{4}\d{6}[HMX][A-Z0-9]{7}$/;
export const CLAVE_ELECTOR_REGEX = /^[A-Z]{6}\d{8}[HM]\d{3}$/;
export const CELULAR_REGEX = /^\d{10}$/;
export const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NAME_REGEX = /^[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s.'-]*$/i;

export const ineSchema: Yup.ObjectSchema<IneFields> = Yup.object({
  nombre: Yup.string()
    .trim()
    .required("El nombre es obligatorio")
    .min(2, "El nombre es demasiado corto")
    .matches(NAME_REGEX, "Usa solo letras"),
  apellidoPaterno: Yup.string()
    .trim()
    .required("El apellido paterno es obligatorio")
    .min(2, "El apellido paterno es demasiado corto")
    .matches(NAME_REGEX, "Usa solo letras"),
  apellidoMaterno: Yup.string()
    .trim()
    .required("El apellido materno es obligatorio")
    .min(1, "El apellido materno es obligatorio")
    .matches(NAME_REGEX, "Usa solo letras"),
  curp: Yup.string()
    .trim()
    .required("El CURP es obligatorio")
    .transform((value: string) => value.toUpperCase())
    .length(18, "El CURP debe tener 18 caracteres")
    .matches(CURP_REGEX, "El CURP no tiene un formato válido"),
  claveElector: Yup.string()
    .trim()
    .required("La clave de elector es obligatoria")
    .transform((value: string) => value.toUpperCase().replace(/\s/g, ""))
    .length(18, "La clave de elector debe tener 18 caracteres")
    .matches(
      /^[A-Z]{6}\d{8}[A-Z]\d{3}$/,
      "La clave de elector no tiene un formato válido",
    ),
  seccion: Yup.string()
    .trim()
    .required("La sección es obligatoria")
    .matches(
      /^(0\d{3}|5515)$/,
      "En Coyoacán la sección es 0 + 3 dígitos, o 5515",
    ),
});

export const chatCoyoSchema: Yup.ObjectSchema<ChatCoyoFields> = ineSchema.concat(
  Yup.object({
    celular: Yup.string()
      .trim()
      .required("El celular es obligatorio")
      .matches(CELULAR_REGEX, "El celular debe tener 10 dígitos"),
    correo: Yup.string()
      .trim()
      .required("El correo es obligatorio")
      .transform((value: string) => value.toLowerCase())
      .matches(CORREO_REGEX, "El correo no es válido"),
    diasVividos: Yup.string().trim().default(""),
    anios: Yup.string().trim().default(""),
    meses: Yup.string().trim().default(""),
    signoZodiacal: Yup.string().trim().default(""),
  }),
);
