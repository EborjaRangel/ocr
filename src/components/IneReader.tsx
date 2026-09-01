"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Form, Formik } from "formik";
import { CameraGuide } from "@/components/CameraGuide";
import { FormField } from "@/components/FormField";
import { RegistrosTable } from "@/components/RegistrosTable";
import { alignIneImage, rotateAlignedImage } from "@/lib/alignImage";
import { missingIneFields } from "@/lib/ineParser";
import { NOT_SHARP_MESSAGE } from "@/lib/imageQuality";
import { readAlignedIne } from "@/lib/ocr";
import { EMPTY_INE_FIELDS, type IneFields, type IneRecord } from "@/lib/types";
import { ineSchema } from "@/lib/validation";

const MAX_FILE_MB = 10;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

type IneReaderProps = {
  initialRegistros: IneRecord[];
};

export function IneReader({ initialRegistros }: IneReaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string>("");
  const alignedBlobRef = useRef<Blob | null>(null);
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [aligned, setAligned] = useState(false);
  const [alignBusy, setAlignBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [initialValues, setInitialValues] = useState<IneFields>(EMPTY_INE_FIELDS);
  const [formKey, setFormKey] = useState(0);
  const [readOk, setReadOk] = useState(false);
  const [rawText, setRawText] = useState("");
  const [showRaw, setShowRaw] = useState(true);
  const [missing, setMissing] = useState<Array<keyof IneFields>>([]);
  const [message, setMessage] = useState<{ type: "ok" | "error" | "blur"; text: string } | null>(
    null,
  );
  const [registros, setRegistros] = useState<IneRecord[]>(initialRegistros);
  const [loadingRegistros, setLoadingRegistros] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const jobRef = useRef(0);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function setPreviewBlob(blob: Blob) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    alignedBlobRef.current = blob;
    setPreviewUrl(url);
  }

  async function loadRegistros() {
    setLoadingRegistros(true);
    try {
      const response = await fetch("/api/registros", { cache: "no-store" });
      const data = (await response.json()) as { registros?: IneRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Error al cargar registros");
      setRegistros(data.registros ?? []);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Error al cargar el CSV",
      });
    } finally {
      setLoadingRegistros(false);
    }
  }

  const fileHint = useMemo(() => {
    if (!fileName) {
      return "En el celular, encuadra la INE en el recuadro de las orillas. También puedes subir una foto de la galería.";
    }
    return aligned
      ? `${fileName} · INE ajustada al recuadro, lista para OCR`
      : `${fileName} · recortando fondo y ajustando tamaño...`;
  }, [fileName, aligned]);

  function clearForm() {
    setReadOk(false);
    setRawText("");
    setMissing([]);
    setInitialValues(EMPTY_INE_FIELDS);
    setFormKey((value) => value + 1);
  }

  async function onSelectFile(nextFile: File | null) {
    if (!nextFile) return;
    if (nextFile.size > MAX_FILE_MB * 1024 * 1024) {
      setMessage({ type: "error", text: "La imagen supera 10 MB." });
      return;
    }
    if (nextFile.type && !ACCEPTED_TYPES.includes(nextFile.type) && !nextFile.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Selecciona una imagen válida." });
      return;
    }

    const job = ++jobRef.current;
    setFileName(nextFile.name);
    setAligned(false);
    clearForm();
    setMessage(null);
    setAlignBusy(true);
    setOcrProgress(35);
    setOcrStatus("Ajustando la credencial al recuadro");
    setPreviewBlob(nextFile);

    try {
      const alignedImage = await alignIneImage(nextFile);
      if (job !== jobRef.current) return;
      setPreviewBlob(alignedImage.blob);
      setAligned(true);
      setOcrStatus("");
      setOcrProgress(0);
      setMessage({
        type: "ok",
        text: "Imagen lista. Gira si hace falta y pulsa Leer credencial.",
      });
    } catch (error) {
      if (job !== jobRef.current) return;
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? `No se pudo alinear la imagen: ${error.message}`
            : "No se pudo alinear la imagen.",
      });
    } finally {
      if (job === jobRef.current) {
        setAlignBusy(false);
        setOcrStatus("");
      }
    }
  }

  async function rotate(degrees: 90 | 180 | 270) {
    if (!alignedBlobRef.current || ocrBusy || alignBusy) return;
    setOcrStatus("Girando imagen");
    const next = await rotateAlignedImage(alignedBlobRef.current, degrees);
    setPreviewBlob(next.blob);
    setAligned(true);
    setOcrStatus("Imagen girada. Pulsa Leer credencial si ya se ve derecha.");
  }

  async function runOcr(target?: Blob, existingJob?: number) {
    const source = target ?? alignedBlobRef.current;
    if (!source) {
      setMessage({ type: "error", text: "Primero sube una foto de la credencial." });
      return;
    }

    const job = existingJob ?? ++jobRef.current;
    setOcrBusy(true);
    setOcrProgress(25);
    setOcrStatus("Leyendo 5 veces cada campo para comparar y confirmar");
    setMessage(null);

    try {
      const result = await readAlignedIne(source, ({ status, progress }) => {
        if (job !== jobRef.current) return;
        setOcrStatus(status);
        setOcrProgress(progress);
      });
      if (job !== jobRef.current) return;

      setInitialValues({
        ...result.fields,
        seccion: result.fields.seccion ? result.fields.seccion.padStart(4, "0") : "",
      });
      setFormKey((value) => value + 1);
      setRawText(result.text);
      setMissing(missingIneFields(result.fields));
      setReadOk(result.foundData);

      if (!result.foundData) {
        setMessage({ type: "blur", text: NOT_SHARP_MESSAGE });
        return;
      }

      setMessage({
        type: "ok",
        text: missingIneFields(result.fields).length
          ? "Se leyeron algunos datos. Completa los que falten y guarda."
          : "Lectura completa. Revisa los datos y guarda en el CSV.",
      });
    } catch (error) {
      if (job !== jobRef.current) return;
      setReadOk(false);
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? `No se pudo leer la imagen: ${error.message}`
            : "No se pudo iniciar el OCR. Recarga la página e inténtalo de nuevo.",
      });
    } finally {
      if (job === jobRef.current) {
        setOcrBusy(false);
        setOcrStatus("");
      }
    }
  }

  async function saveRegistro(values: IneFields) {
    const response = await fetch("/api/registros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "No se pudo guardar el registro");
    }
    await loadRegistros();
    setMessage({ type: "ok", text: "Registro agregado al archivo CSV." });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 border-b border-[#7A1F3D]/15 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7A1F3D]">
          Instituto · Lectura local
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Lector de credencial INE
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-stone-600">
          Toma la foto desde el celular: un recuadro en las orillas te indica
          a qué distancia poner la INE. Cuando llene el marco, dispara. Luego
          pulsa Leer credencial.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900">1. Alinear y leer</h2>
          <p className="mt-1 text-sm text-stone-500">{fileHint}</p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="inline-flex h-11 items-center rounded-xl bg-[#7A1F3D] px-4 text-sm font-medium text-white transition hover:bg-[#641832]"
            >
              Tomar foto
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-11 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 transition hover:bg-stone-50"
            >
              Galería
            </button>
            <button
              type="button"
              onClick={() => void rotate(270)}
              disabled={!aligned || ocrBusy || alignBusy}
              className="inline-flex h-11 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Girar izq.
            </button>
            <button
              type="button"
              onClick={() => void rotate(90)}
              disabled={!aligned || ocrBusy || alignBusy}
              className="inline-flex h-11 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Girar der.
            </button>
            <button
              type="button"
              onClick={() => void rotate(180)}
              disabled={!aligned || ocrBusy || alignBusy}
              className="inline-flex h-11 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Girar 180°
            </button>
            <button
              type="button"
              onClick={() => void runOcr()}
              disabled={!aligned || ocrBusy || alignBusy}
              className="inline-flex h-11 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ocrBusy ? "Leyendo..." : alignBusy ? "Alineando..." : "Leer credencial"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void onSelectFile(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </div>

          <div
            className="mt-5 aspect-[1600/1010] overflow-hidden rounded-xl border border-stone-200 bg-stone-50"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void onSelectFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Credencial alineada"
                className="h-full w-full object-fill"
              />
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-stone-500">
                <span className="font-medium text-stone-700">Sin imagen</span>
                <span>
                  Pulsa Tomar foto y acerca el teléfono hasta que la credencial
                  llene el recuadro. Después pulsa Leer credencial.
                </span>
              </div>
            )}
          </div>

          {aligned && (
            <p className="mt-2 text-xs font-medium text-emerald-700">
              Imagen alineada. Si el nombre no queda arriba y la foto a la
              derecha, usa Girar y luego Leer credencial.
            </p>
          )}

          {(ocrBusy || alignBusy) && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
                <span>{ocrStatus || "Procesando"}</span>
                <span>{ocrProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full rounded-full bg-[#C4A35A] transition-all"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900">2. Datos extraídos</h2>
          <p className="mt-1 text-sm text-stone-500">
            {readOk
              ? "Corrige si hace falta y guarda. Formik y Yup validan antes de escribir el CSV."
              : "Los datos aparecen después de alinear y leer la credencial."}
          </p>

          <Formik
            key={formKey}
            initialValues={initialValues}
            validationSchema={ineSchema}
            enableReinitialize
            onSubmit={async (values, helpers) => {
              try {
                await saveRegistro(values);
                helpers.setSubmitting(false);
              } catch (error) {
                helpers.setSubmitting(false);
                setMessage({
                  type: "error",
                  text: error instanceof Error ? error.message : "No se pudo guardar",
                });
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form className="mt-5 flex flex-col gap-4">
                <FormField name="nombre" label="Nombre" placeholder="MARÍA FERNANDA" uppercase />
                <FormField
                  name="apellidoPaterno"
                  label="Apellido paterno"
                  placeholder="GARCÍA"
                  uppercase
                />
                <FormField
                  name="apellidoMaterno"
                  label="Apellido materno"
                  placeholder="LÓPEZ"
                  uppercase
                />
                <FormField
                  name="curp"
                  label="CURP"
                  placeholder="GALG850101MDFRPR09"
                  maxLength={18}
                  uppercase
                />
                <FormField
                  name="seccion"
                  label="Sección"
                  placeholder="0000"
                  maxLength={4}
                  inputMode="numeric"
                  painted
                />

                {missing.length > 0 && readOk && (
                  <p className="text-xs text-amber-700">Completa: {missing.join(", ")}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || ocrBusy}
                  className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-[#7A1F3D] px-4 text-sm font-medium text-white transition hover:bg-[#641832] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Guardando..." : "Guardar en CSV"}
                </button>
              </Form>
            )}
          </Formik>
        </section>
      </div>

      {message?.type === "blur" && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-950"
        >
          <p className="text-base font-semibold">{NOT_SHARP_MESSAGE}</p>
          <p className="mt-1 text-sm text-amber-900">
            Alinea la credencial con los botones Girar (nombre arriba, foto a la
            derecha) y pulsa Leer credencial. Si sigue sin leer, toma otra foto
            de frente y con buena luz.
          </p>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="mt-3 inline-flex h-11 items-center rounded-xl bg-[#7A1F3D] px-4 text-sm font-medium text-white transition hover:bg-[#641832]"
          >
            Volver a tomar foto
          </button>
        </div>
      )}

      {rawText ? (
        <div>
          <button
            type="button"
            onClick={() => setShowRaw((value) => !value)}
            className="text-sm font-medium text-[#7A1F3D] underline-offset-2 hover:underline"
          >
            {showRaw ? "Ocultar texto leído" : "Ver texto que leyó el OCR"}
          </button>
          {showRaw && (
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-stone-900 p-4 text-xs leading-5 text-stone-100">
              {rawText}
            </pre>
          )}
        </div>
      ) : null}

      {message && message.type !== "blur" && (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            message.type === "ok"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">3. CSV acumulado</h2>
            <p className="text-sm text-stone-500">
              {registros.length} lectura{registros.length === 1 ? "" : "s"} en{" "}
              <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">
                data/registros.csv
              </code>
            </p>
          </div>
          <a
            href="/api/registros/download"
            className="inline-flex h-11 items-center rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-800 transition hover:bg-stone-50"
          >
            Descargar CSV
          </a>
        </div>
        <RegistrosTable registros={registros} loading={loadingRegistros} />
      </section>

      {cameraOpen ? (
        <CameraGuide
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => {
            setCameraOpen(false);
            void onSelectFile(file);
          }}
        />
      ) : null}
    </div>
  );
}
