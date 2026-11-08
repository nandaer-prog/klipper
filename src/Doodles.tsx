import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { clamp, jitter, onThrees, onTwos } from "./stopMotion";

export type ArrowKind = "curve" | "loop" | "striped";

/** Bentuk panah dalam kotak lokal: ujung (tip) dan arah kepala panah (derajat). */
const ARROWS: Record<ArrowKind, { d: string; tip: [number, number]; angle: number; w: number; h: number }> = {
  curve: { d: "M10 150 C 70 40, 170 20, 250 52", tip: [250, 52], angle: 21.8, w: 270, h: 170 },
  loop: { d: "M10 160 C 40 70, 140 60, 128 122 C 118 176, 52 150, 88 104 C 124 58, 200 40, 252 56", tip: [252, 56], angle: 17.1, w: 270, h: 180 },
  striped: { d: "M14 120 Q 130 96 244 60", tip: [244, 60], angle: -17.5, w: 260, h: 140 },
};

/**
 * Panah kartun gaya coretan tangan (isi putih, garis hitam tebal) yang "tergambar"
 * dari ekor ke kepala, lalu menunjuk-nunjuk. (x, y) = posisi ujung panah di layar,
 * pointAt = arah kepala panah di layar dalam derajat (0 = ke kanan, 90 = ke bawah).
 */
export const ArrowDoodle: React.FC<{
  kind: ArrowKind;
  x: number;
  y: number;
  pointAt: number;
  mirror?: boolean;
  scale?: number;
  delay?: number;
  seed: string;
}> = ({ kind, x, y, pointAt, mirror = false, scale = 1, delay = 0, seed }) => {
  const frame = useCurrentFrame();
  const a = ARROWS[kind];
  const q = onTwos(frame - delay);
  if (q < 0) return null;
  const draw = interpolate(q, [0, 8], [0, 1], clamp);
  const head = interpolate(q, [8, 10, 12], [0, 1.3, 1], clamp);
  const settled = q > 12;
  // menunjuk-nunjuk ke arah sasaran + goyang tangan
  const poke = settled ? Math.sin(onThrees(frame) / 3) * 7 : 0;
  const rad = (pointAt * Math.PI) / 180;
  const localDir = mirror ? 180 - a.angle : a.angle;
  const rotate = pointAt - localDir + (settled ? jitter(`${seed}-w`, frame) * 2 : 0);
  const [tx, ty] = a.tip;
  const thick = kind === "striped";
  return (
    <svg
      width={a.w}
      height={a.h}
      viewBox={`0 0 ${a.w} ${a.h}`}
      style={{
        position: "absolute",
        left: x - tx,
        top: y - ty,
        overflow: "visible",
        transformOrigin: `${tx}px ${ty}px`,
        transform: `translate(${Math.cos(rad) * poke}px, ${Math.sin(rad) * poke}px) rotate(${rotate}deg) scale(${(mirror ? -1 : 1) * scale}, ${scale})`,
        filter: "drop-shadow(0 6px 6px rgba(0,0,0,.35))",
      }}
    >
      <path d={a.d} fill="none" stroke="#111" strokeWidth={thick ? 36 : 22} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} />
      <path d={a.d} fill="none" stroke="#fff" strokeWidth={thick ? 24 : 12} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} />
      {thick && draw >= 1 ? <path d={a.d} fill="none" stroke="#111" strokeWidth={24} pathLength={1} strokeDasharray="0.05 0.05" /> : null}
      <g transform={`translate(${tx} ${ty}) rotate(${a.angle}) scale(${head * (thick ? 1.3 : 1)})`}>
        <path d="M8 0 L-44 -28 L-32 0 L-44 28 Z" fill="#fff" stroke="#111" strokeWidth={7} strokeLinejoin="round" />
      </g>
    </svg>
  );
};
