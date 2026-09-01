"use client";

import { useEffect, useRef, useState } from "react";

const INE_RATIO = 1600 / 1010;

type CameraGuideProps = {
  onCapture: (file: File) => void;
  onClose: () => void;
};

function guideRect(viewW: number, viewH: number) {
  const insetX = Math.max(10, viewW * 0.035);
  const insetY = Math.max(10, viewH * 0.035);
  const maxW = viewW - insetX * 2;
  const maxH = viewH - insetY * 2;
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
  return {
    x: Math.max(0, (sx - offsetX) / scale),
    y: Math.max(0, (sy - offsetY) / scale),
    width: sw / scale,
    height: sh / scale,
  };
}

export function CameraGuide({ onCapture, onClose }: CameraGuideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
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
    const node = videoRef.current?.parentElement;
    function measure() {
      const host = node ?? document.documentElement;
      setSize({ width: host.clientWidth, height: host.clientHeight });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
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
    if (!video || !ready || video.videoWidth === 0) return;

    const viewW = size.width || window.innerWidth;
    const viewH = size.height || window.innerHeight;
    const frame = guideRect(viewW, viewH);
    const source = screenToVideo(
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      viewW,
      viewH,
      video.videoWidth,
      video.videoHeight,
    );

    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1010;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      video,
      source.x,
      source.y,
      Math.min(source.width, video.videoWidth - source.x),
      Math.min(source.height, video.videoHeight - source.y),
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.93);
    });
    if (!blob) return;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    onCapture(new File([blob], "ine-camara.jpg", { type: "image/jpeg" }));
  }

  const frame = guideRect(size.width || 1, size.height || 1);

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${size.width || 1} ${size.height || 1}`}
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="ine-hole">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={frame.x}
              y={frame.y}
              width={frame.width}
              height={frame.height}
              rx="10"
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.58)" mask="url(#ine-hole)" />
        <rect
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          rx="10"
          fill="none"
          stroke="#C4A35A"
          strokeWidth="3"
        />
        {(
          [
            [frame.x, frame.y, 1, 1],
            [frame.x + frame.width, frame.y, -1, 1],
            [frame.x, frame.y + frame.height, 1, -1],
            [frame.x + frame.width, frame.y + frame.height, -1, -1],
          ] as Array<[number, number, number, number]>
        ).map(([x, y, dx, dy], index) => (
          <path
            key={index}
            d={`M ${x + 28 * dx} ${y} H ${x} V ${y + 28 * dy}`}
            fill="none"
            stroke="#F7F3EE"
            strokeWidth="5"
            strokeLinecap="square"
          />
        ))}
      </svg>

      <div
        className="pointer-events-none absolute left-4 right-4 text-center"
        style={{ top: `max(12px, calc(env(safe-area-inset-top) + 10px))` }}
      >
        <p className="text-sm font-semibold tracking-wide">Coloca la INE dentro del recuadro</p>
        <p className="mt-1 text-xs text-white/80">
          Acerca o aleja el teléfono hasta que los bordes de la credencial toquen
          el marco.
        </p>
      </div>

      {error ? (
        <p className="absolute left-4 right-4 top-1/2 -translate-y-1/2 rounded-xl bg-black/70 px-4 py-3 text-center text-sm">
          {error}
        </p>
      ) : null}

      <div
        className="absolute inset-x-0 flex items-center justify-center gap-10"
        style={{ bottom: `max(20px, calc(env(safe-area-inset-bottom) + 16px))` }}
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
          className="h-18 w-18 rounded-full border-4 border-white bg-[#C4A35A] disabled:opacity-40"
          style={{ height: 72, width: 72 }}
        />
        <span className="w-[5.5rem] text-center text-xs text-white/70">
          {ready ? "Foto" : "Abrir…"}
        </span>
      </div>
    </div>
  );
}
