"use client";

import { useEffect, useRef, useState } from "react";

const INE_RATIO = 1600 / 1010;
const EDGE_MARGIN = 0.018;
const INNER_PAD = 0.03;
const TOP_CHROME = 56;
const BOTTOM_CHROME = 104;

/** Right-of-photo column on a framed INE. */
const NAME_LEFT = 0.29;
const NAME_RIGHT = 0.86;
const NAME_TOP = 0.12;
const NAME_BOTTOM = 0.4;
/** First line after NOMBRE: apellido paterno. */
const PATERNO_Y = 0.215;

type CameraGuideProps = {
  onCapture: (file: File) => void;
  onClose: () => void;
};

type Rect = { x: number; y: number; width: number; height: number };
type Insets = { top: number; bottom: number; left: number; right: number };

function cssPx(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readSafeInsets(): Insets {
  const root = getComputedStyle(document.documentElement);
  return {
    top: cssPx(root.getPropertyValue("--sat")),
    bottom: cssPx(root.getPropertyValue("--sab")),
    left: cssPx(root.getPropertyValue("--sal")),
    right: cssPx(root.getPropertyValue("--sar")),
  };
}

function outerGuide(viewW: number, viewH: number, inset: Insets): Rect {
  const padTop = inset.top + TOP_CHROME;
  const padBottom = inset.bottom + BOTTOM_CHROME;
  const padX = Math.max(inset.left, inset.right, viewW * EDGE_MARGIN, 8);
  const maxW = Math.max(40, viewW - padX * 2);
  const maxH = Math.max(28, viewH - padTop - padBottom);
  let width = maxW;
  let height = width / INE_RATIO;
  if (height > maxH) {
    height = maxH;
    width = height * INE_RATIO;
  }
  return {
    x: (viewW - width) / 2,
    y: padTop + (maxH - height) / 2,
    width,
    height,
  };
}

function innerGuide(outer: Rect): Rect {
  const padX = outer.width * INNER_PAD;
  const padY = outer.height * INNER_PAD;
  return {
    x: outer.x + padX,
    y: outer.y + padY,
    width: outer.width - padX * 2,
    height: outer.height - padY * 2,
  };
}

function screenToVideo(
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  viewW: number,
  viewH: number,
  videoW: number,
  videoH: number,
) {
  const scale = Math.max(viewW / videoW, viewH / videoH);
  const shownW = videoW * scale;
  const shownH = videoH * scale;
  const offsetX = (viewW - shownW) / 2;
  const offsetY = (viewH - shownH) / 2;
  const x = (sx - offsetX) / scale;
  const y = (sy - offsetY) / scale;
  const width = sw / scale;
  const height = sh / scale;
  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.max(8, width),
    height: Math.max(8, height),
  };
}

export function CameraGuide({ onCapture, onClose }: CameraGuideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [insets, setInsets] = useState<Insets>({ top: 0, bottom: 0, left: 0, right: 0 });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function measure() {
      const node = stageRef.current;
      if (!node) return;
      const vv = window.visualViewport;
      if (vv) {
        node.style.top = `${vv.offsetTop}px`;
        node.style.left = `${vv.offsetLeft}px`;
        node.style.width = `${vv.width}px`;
        node.style.height = `${vv.height}px`;
      }
      const box = node.getBoundingClientRect();
      setSize({ width: box.width, height: box.height });
      setInsets(readSafeInsets());
    }

    measure();
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("orientationchange", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.setAttribute("playsinline", "true");
          video.setAttribute("webkit-playsinline", "true");
          video.srcObject = stream;
          await video.play();
        }
        setReady(true);
        requestAnimationFrame(() => {
          const node = stageRef.current;
          if (!node) return;
          const box = node.getBoundingClientRect();
          setSize({ width: box.width, height: box.height });
          setInsets(readSafeInsets());
        });
      } catch {
        if (!cancelled) {
          setError("No se pudo abrir la cámara. Revisa el permiso o usa Galería.");
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function capture() {
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || !stage || !ready || video.videoWidth === 0) return;

    const box = stage.getBoundingClientRect();
    const viewW = box.width || size.width || window.innerWidth;
    const viewH = box.height || size.height || window.innerHeight;
    const captureBox = innerGuide(outerGuide(viewW, viewH, insets));
    const source = screenToVideo(
      captureBox.x,
      captureBox.y,
      captureBox.width,
      captureBox.height,
      viewW,
      viewH,
      video.videoWidth,
      video.videoHeight,
    );

    const sx = Math.min(source.x, video.videoWidth - 8);
    const sy = Math.min(source.y, video.videoHeight - 8);
    const sw = Math.min(source.width, video.videoWidth - sx);
    const sh = Math.min(source.height, video.videoHeight - sy);

    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1010;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.93);
    });
    if (!blob) return;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    onCapture(new File([blob], "ine-camara.jpg", { type: "image/jpeg" }));
  }

  const viewW = size.width || 1;
  const viewH = size.height || 1;
  const outer = outerGuide(viewW, viewH, insets);
  const inner = innerGuide(outer);
  const nameBox = {
    x: inner.x + inner.width * NAME_LEFT,
    y: inner.y + inner.height * NAME_TOP,
    width: inner.width * (NAME_RIGHT - NAME_LEFT),
    height: inner.height * (NAME_BOTTOM - NAME_TOP),
  };
  const paternoY = inner.y + inner.height * PATERNO_Y;

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-50 overflow-hidden bg-black text-white"
      style={{ width: "100dvw", height: "100dvh" }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover object-center"
        playsInline
        muted
        autoPlay
      />

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="ine-hole">
            <rect width="100%" height="100%" fill="white" />
            <rect x={outer.x} y={outer.y} width={outer.width} height={outer.height} rx="10" fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.58)" mask="url(#ine-hole)" />
        <rect
          x={outer.x}
          y={outer.y}
          width={outer.width}
          height={outer.height}
          rx="10"
          fill="none"
          stroke="#C4A35A"
          strokeWidth="3"
        />
        <rect
          x={inner.x}
          y={inner.y}
          width={inner.width}
          height={inner.height}
          rx="6"
          fill="none"
          stroke="#F7F3EE"
          strokeWidth="2"
          strokeDasharray="8 6"
        />
        <rect
          x={nameBox.x}
          y={nameBox.y}
          width={nameBox.width}
          height={nameBox.height}
          rx="4"
          fill="rgba(196,163,90,0.08)"
          stroke="#C4A35A"
          strokeWidth="1.5"
        />
        <line
          x1={nameBox.x}
          y1={paternoY}
          x2={nameBox.x + nameBox.width}
          y2={paternoY}
          stroke="#F4D27A"
          strokeWidth="2.5"
        />
        <line
          x1={nameBox.x}
          y1={paternoY - 7}
          x2={nameBox.x}
          y2={paternoY + 7}
          stroke="#F4D27A"
          strokeWidth="2.5"
        />
        <line
          x1={nameBox.x + nameBox.width}
          y1={paternoY - 7}
          x2={nameBox.x + nameBox.width}
          y2={paternoY + 7}
          stroke="#F4D27A"
          strokeWidth="2.5"
        />
        {(
          [
            [outer.x, outer.y, 1, 1],
            [outer.x + outer.width, outer.y, -1, 1],
            [outer.x, outer.y + outer.height, 1, -1],
            [outer.x + outer.width, outer.y + outer.height, -1, -1],
          ] as Array<[number, number, number, number]>
        ).map(([x, y, dx, dy], index) => (
          <path
            key={index}
            d={`M ${x + 26 * dx} ${y} H ${x} V ${y + 26 * dy}`}
            fill="none"
            stroke="#F7F3EE"
            strokeWidth="5"
            strokeLinecap="square"
          />
        ))}
      </svg>

      <div
        className="pointer-events-none absolute text-[10px] font-semibold uppercase tracking-wide text-[#F4D27A]"
        style={{
          left: nameBox.x + 4,
          top: paternoY - 16,
          textShadow: "0 1px 3px rgba(0,0,0,0.85)",
        }}
      >
        Apellido paterno
      </div>

      <div
        className="pointer-events-none absolute left-4 right-4 text-center"
        style={{ top: `max(8px, calc(env(safe-area-inset-top) + 6px))` }}
      >
        <p className="text-sm font-semibold tracking-wide">Llena el recuadro interior</p>
        <p className="mt-1 text-xs text-white/80">
          Pon el apellido paterno sobre la línea dorada, a la derecha de la foto.
        </p>
      </div>

      {error ? (
        <p className="absolute left-4 right-4 top-1/2 -translate-y-1/2 rounded-xl bg-black/70 px-4 py-3 text-center text-sm">
          {error}
        </p>
      ) : null}

      <div
        className="absolute inset-x-0 flex items-center justify-center gap-10"
        style={{ bottom: `max(16px, calc(env(safe-area-inset-bottom) + 12px))` }}
      >
        <button
          type="button"
          onClick={onClose}
          className="h-12 rounded-full bg-white/15 px-5 text-sm font-medium backdrop-blur"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void capture()}
          disabled={!ready}
          aria-label="Tomar foto"
          className="rounded-full border-4 border-white bg-[#C4A35A] disabled:opacity-40"
          style={{ height: 72, width: 72 }}
        />
        <span className="w-[5.5rem] text-center text-xs text-white/70">
          {ready ? "Foto" : "Abrir…"}
        </span>
      </div>
    </div>
  );
}
