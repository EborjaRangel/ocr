"use client";

import { useEffect, useRef, useState } from "react";

const INE_RATIO = 1600 / 1010;
const EDGE_MARGIN = 0.016;
const INNER_PAD = 0.03;

type CameraGuideProps = {
  onCapture: (file: File) => void;
  onClose: () => void;
};

type Rect = { x: number; y: number; width: number; height: number };

function outerGuide(viewW: number, viewH: number): Rect {
  const insetX = Math.max(6, viewW * EDGE_MARGIN);
  const insetY = Math.max(6, viewH * EDGE_MARGIN);
  const maxW = Math.max(40, viewW - insetX * 2);
  const maxH = Math.max(28, viewH - insetY * 2);
  let width = maxW;
  let height = width / INE_RATIO;
  if (height > maxH) {
    height = maxH;
    width = height * INE_RATIO;
  }
  return {
    x: (viewW - width) / 2,
    y: (viewH - height) / 2,
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
      const box = node.getBoundingClientRect();
      setSize({ width: box.width, height: box.height });
    }

    measure();
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("orientationchange", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", measure);
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
          video.srcObject = stream;
          await video.play();
        }
        setReady(true);
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
    const captureBox = innerGuide(outerGuide(viewW, viewH));
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
  const outer = outerGuide(viewW, viewH);
  const inner = innerGuide(outer);

  return (
    <div ref={stageRef} className="fixed inset-0 z-50 bg-black text-white">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
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
        className="pointer-events-none absolute left-4 right-4 text-center"
        style={{ top: `max(10px, calc(env(safe-area-inset-top) + 8px))` }}
      >
        <p className="text-sm font-semibold tracking-wide">Llena el recuadro interior</p>
        <p className="mt-1 text-xs text-white/80">
          Acerca la INE hasta la línea punteada. El margen dorado debe quedar
          libre para que se vea nítida.
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
