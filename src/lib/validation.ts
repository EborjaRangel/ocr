import * as Yup from "yup";
import type { IneFields } from "./types";

export const CURP_REGEX = /^[A-Z]{4}\d{6}[HMX][A-Z0-9]{7}$/;

const NAME_REGEX = /^[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s.'-]*$/i;

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
  seccion: Yup.string()
    .trim()
    .required("La sección es obligatoria")
    .matches(
      /^(0\d{3}|5515)$/,
      "En Coyoacán la sección es 0 + 3 dígitos, o 5515",
    ),
});
