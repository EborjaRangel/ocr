"use client";

import type { IneRecord } from "@/lib/types";

type RegistrosTableProps = {
  registros: IneRecord[];
  loading: boolean;
};

function formatFecha(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function RegistrosTable({ registros, loading }: RegistrosTableProps) {
  if (loading) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
        Cargando registros...
      </p>
    );
  }

  if (registros.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
        Aún no hay lecturas. Cada credencial reconocida se agregará a este
        archivo CSV.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200">
      <table className="min-w-full divide-y divide-stone-200 text-left text-sm">
        <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-3 py-3 font-semibold">Fecha</th>
            <th className="px-3 py-3 font-semibold">Nombre</th>
            <th className="px-3 py-3 font-semibold">Apellido paterno</th>
            <th className="px-3 py-3 font-semibold">Apellido materno</th>
            <th className="px-3 py-3 font-semibold">CURP</th>
            <th className="px-3 py-3 font-semibold">Sección</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 bg-white">
          {[...registros].reverse().map((registro, index) => (
            <tr key={`${registro.curp}-${registro.fecha}-${index}`}>
              <td className="whitespace-nowrap px-3 py-3 text-stone-500">
                {formatFecha(registro.fecha)}
              </td>
              <td className="px-3 py-3 font-medium text-stone-900">
                {registro.nombre}
              </td>
              <td className="px-3 py-3 text-stone-800">
                {registro.apellidoPaterno}
              </td>
              <td className="px-3 py-3 text-stone-800">
                {registro.apellidoMaterno}
              </td>
              <td className="px-3 py-3 font-mono text-xs text-stone-800">
                {registro.curp}
              </td>
              <td className="px-3 py-3">
                <span className="inline-flex min-w-16 items-center justify-center rounded-lg bg-[#F6E8C3] px-2 py-1 font-mono text-sm font-bold tracking-widest text-stone-900">
                  {registro.seccion}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
