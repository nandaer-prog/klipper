import React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import { clamp, onTwos, svgId } from "./stopMotion";

/** Warna tinta risograph fluoresen. */
export const RISO = { pink: "#ff4fa3", purple: "#7a5cff", teal: "#1fc7c1", yellow: "#ffd23f", blue: "#2f6fe4" };
const PAIRS: [string, string][] = [
  [RISO.pink, RISO.teal],
  [RISO.purple, RISO.pink],
  [RISO.teal, RISO.purple],
  [RISO.yellow, RISO.pink],
  [RISO.blue, RISO.yellow],
];

export type RisoKind = "star" | "bolt" | "blob" | "flower" | "spiral" | "triangle" | "ring" | "squiggle" | "plus" | "crescent";
export const RISO_KINDS: RisoKind[] = ["star", "bolt", "blob", "flower", "spiral", "triangle", "ring", "squiggle", "plus", "crescent"];

const STAR = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 ? 52 : 96;
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${(100 + Math.cos(a) * r).toFixed(1)} ${(100 + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
})();

const FILLED: Partial<Record<RisoKind, string>> = {
  star: STAR,
  bolt: "M118 8 L44 112 H96 L78 192 L158 78 H106 Z",
  blob: "M100 14 C142 8 188 46 182 98 C177 148 140 188 94 184 C48 180 12 146 18 98 C24 52 58 20 100 14 Z",
  triangle: "M100 18 L186 172 H14 Z",
  plus: "M76 14 H124 V76 H186 V124 H124 V186 H76 V124 H14 V76 H76 Z",
  crescent: "M132 16 A86 86 0 1 0 132 184 A72 72 0 1 1 132 16 Z",
};
const STROKED: Partial<Record<RisoKind, string>> = {
  spiral: "M100 100 a8 8 0 1 1 16 0 a16 16 0 1 1 -32 0 a26 26 0 1 1 52 0 a38 38 0 1 1 -76 0 a52 52 0 1 1 104 0",
  squiggle: "M8 110 Q32 60 56 110 T104 110 T152 110 T200 110",
};

/** Satu bentuk dengan warna tertentu (dipakai untuk lapisan tinta dan lapisan titik halftone). */
const shape = (kind: RisoKind, fill: string): React.ReactNode => {
  const filled = FILLED[kind];
  if (filled) return <path d={filled} fill={fill} />;
  const stroked = STROKED[kind];
  if (stroked) return <path d={stroked} fill="none" stroke={fill} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />;
  if (kind === "ring") return <circle cx={100} cy={100} r={72} fill="none" stroke={fill} strokeWidth={22} strokeLinecap="round" strokeDasharray="1 30" />;
  // bunga: enam kelopak lingkaran + tengah
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <circle key={i} cx={100 + Math.cos((i / 6) * Math.PI * 2) * 52} cy={100 + Math.sin((i / 6) * Math.PI * 2) * 52} r={42} fill={fill} />
      ))}
      <circle cx={100} cy={100} r={44} fill={fill} />
    </>
  );
};

/**
 * Bentuk abstrak gaya cetak risograph: dua tinta yang sengaja meleset (misregistrasi),
 * titik halftone, dan bintik tinta. Bergerak "on twos" seperti animasi stop-motion.
 */
export const RisoShape: React.FC<{ kind: RisoKind; size: number; seed: string; frame: number; colors?: [string, string] }> = ({
  kind,
  size,
  seed,
  frame,
  colors,
}) => {
  const [a, b] = colors ?? PAIRS[Math.floor(random(`${seed}-c`) * PAIRS.length)]!;
  const id = svgId(seed);
  const q = onTwos(frame);
  const enter = interpolate(q, [0, 2, 4, 6], [0, 1.25, 0.92, 1], clamp);
  let motion = "";
  if (kind === "star" || kind === "flower" || kind === "spiral" || kind === "plus") motion = `rotate(${q * 3}deg)`;
  else if (kind === "blob") motion = `scale(${1 + Math.sin(q / 5) * 0.07}, ${1 - Math.sin(q / 5) * 0.07})`;
  else if (kind === "ring") motion = `scale(${1 + Math.abs(Math.sin(q / 6)) * 0.1})`;
  else if (kind === "squiggle") motion = `translateY(${Math.sin(q / 6) * 10}px)`;
  else if (kind === "crescent") motion = `rotate(${Math.sin(q / 8) * 14}deg)`;
  else if (kind === "triangle") motion = `scale(${1 + Math.sin(q / 4) * 0.06})`;
  else motion = `rotate(${(random(`${seed}-b-${Math.floor(q / 4)}`) - 0.5) * 12}deg)`;
  return (
    <svg width={size} height={size} viewBox="-10 -10 220 220" style={{ overflow: "visible", transform: `scale(${enter}) ${motion}` }}>
      <defs>
        <pattern id={`${id}-dots`} width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
          <circle cx={4.5} cy={4.5} r={2.3} fill="rgba(25,10,45,.5)" />
        </pattern>
        {/* bintik tinta: noise yang melubangi sebagian kecil tinta */}
        <filter id={`${id}-grain`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(random(seed) * 100)} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 9 -5.8" result="specks" />
          <feComposite in="SourceGraphic" in2="specks" operator="out" />
        </filter>
      </defs>
      <g style={{ isolation: "isolate" }}>
        <g transform="translate(8 7)">{shape(kind, b)}</g>
        <g style={{ mixBlendMode: "multiply" }} filter={`url(#${id}-grain)`}>
          {shape(kind, a)}
          {shape(kind, `url(#${id}-dots)`)}
        </g>
      </g>
    </svg>
  );
};

export type RisoSpot = { x: number; y: number; size: number; delay?: number; kind?: RisoKind };

/** Beberapa bentuk risograph di titik tertentu (koordinat pusat, piksel layar). */
export const RisoDeco: React.FC<{ seed: string; spots: RisoSpot[] }> = ({ seed, spots }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {spots.map((s, i) => {
        const kind = s.kind ?? RISO_KINDS[Math.floor(random(`${seed}-k-${i}`) * RISO_KINDS.length)]!;
        return (
          <div key={i} style={{ position: "absolute", left: s.x - s.size / 2, top: s.y - s.size / 2, width: s.size, height: s.size }}>
            <RisoShape kind={kind} size={s.size} seed={`${seed}-${i}`} frame={frame - (s.delay ?? 0)} />
          </div>
        );
      })}
    </>
  );
};
