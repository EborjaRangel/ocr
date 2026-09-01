"use client";

import type { HTMLAttributes } from "react";
import { ErrorMessage, Field, type FieldProps } from "formik";

type FormFieldProps = {
  name: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  uppercase?: boolean;
  disabled?: boolean;
  painted?: boolean;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
};

export function FormField({
  name,
  label,
  placeholder,
  autoComplete = "off",
  maxLength,
  uppercase = false,
  disabled = false,
  painted = false,
  inputMode,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-stone-700">
        {label}
      </label>
      <Field name={name}>
        {({ field, form }: FieldProps<string>) => {
          const filled = Boolean(field.value);
          return (
            <input
              {...field}
              id={name}
              autoComplete={autoComplete}
              maxLength={maxLength}
              placeholder={placeholder}
              inputMode={inputMode}
              className={`h-11 rounded-xl border px-3 shadow-sm outline-none transition placeholder:text-stone-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500 ${
                painted && filled
                  ? "border-[#C4A35A] bg-[#F6E8C3] text-lg font-bold tracking-[0.28em] text-stone-900 focus:border-[#C4A35A] focus:ring-[#C4A35A]/30"
                  : filled
                    ? "border-emerald-400 bg-emerald-50 text-sm font-semibold text-stone-900 focus:border-[#7A1F3D] focus:ring-[#7A1F3D]/20"
                    : "border-stone-300 bg-white text-sm text-stone-900 focus:border-[#7A1F3D] focus:ring-[#7A1F3D]/20"
              }`}
              disabled={disabled}
              onChange={(event) => {
                const value = uppercase
                  ? event.target.value.toUpperCase()
                  : event.target.value;
                void form.setFieldValue(name, value);
              }}
            />
          );
        }}
      </Field>
      <ErrorMessage
        name={name}
        component="p"
        className="text-xs font-medium text-red-600"
      />
    </div>
  );
}
