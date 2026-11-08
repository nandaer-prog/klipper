import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { RisoDeco } from "./Riso";
import { PAPER_NOISE, clamp } from "./stopMotion";

/** Latar terowongan neon (gaya VJ loop): bingkai neon membesar dari tengah tanpa henti. */
export const NeonTunnel: React.FC<{ frame: number }> = ({ frame }) => {
  const rings = 9;
  const colors = ["#ff2bd6", "#00e5ff", "#7a5cff"];
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, #2a0b4d 0%, #0b0620 60%, #05030f 100%)" }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        {Array.from({ length: rings }, (_, i) => {
          const z = ((i + frame / 16) % rings) / rings;
          const s = Math.pow(z, 2.2) * 2.4 + 0.02;
          const w = 420 * s;
          const h = 640 * s;
          const c = colors[i % colors.length]!;
          const op = interpolate(z, [0, 0.15, 0.85, 1], [0, 1, 1, 0], clamp);
          return (
            <g key={i} opacity={op}>
              <rect x={540 - w} y={860 - h} width={w * 2} height={h * 2} rx={70 * s} fill="none" stroke={c} strokeOpacity={0.25} strokeWidth={28 * s + 8} />
              <rect x={540 - w} y={860 - h} width={w * 2} height={h * 2} rx={70 * s} fill="none" stroke={c} strokeWidth={6 * s + 2} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** Latar synthwave: langit ungu-pink, matahari bergaris, lantai grid yang bergerak mendekat. */
export const SynthGrid: React.FC<{ frame: number }> = ({ frame }) => {
  const horizon = 900;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #12021f 0%, #3b0a57 30%, #ff2e88 46.8%, #12021f 46.9%, #0d0118 100%)" }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <defs>
          <linearGradient id="synthSun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd23f" />
            <stop offset="75%" stopColor="#ff4fa3" />
          </linearGradient>
          <clipPath id="synthSunClip">
            <rect x={0} y={0} width={1080} height={horizon} />
          </clipPath>
        </defs>
        <g clipPath="url(#synthSunClip)">
          <circle cx={540} cy={horizon - 170} r={250} fill="url(#synthSun)" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={250} y={horizon - 190 + i * 42} width={580} height={6 + i * 4} fill="#2a0640" />
          ))}
        </g>
        {Array.from({ length: 21 }, (_, i) => {
          const k = i - 10;
          return <line key={`v${i}`} x1={540 + k * 16} y1={horizon} x2={540 + k * 190} y2={1920} stroke="#ff2bd6" strokeOpacity={0.7} strokeWidth={3} />;
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const z = ((i + frame / 10) % 12) / 12;
          const y = horizon + (1920 - horizon) * Math.pow(z, 2.4);
          return <line key={`h${i}`} x1={0} y1={y} x2={1080} y2={y} stroke="#ff2bd6" strokeOpacity={0.2 + z * 0.8} strokeWidth={2 + z * 4} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** Latar kertas bertekstur dengan bentuk-bentuk risograph (gaya kolase/zine). */
export const RisoPaper: React.FC<{ seed: string }> = ({ seed }) => (
  <AbsoluteFill style={{ backgroundColor: "#f3ecdf", backgroundImage: PAPER_NOISE }}>
    <RisoDeco
      seed={seed}
      spots={[
        { x: 180, y: 260, size: 260 },
        { x: 910, y: 420, size: 220, delay: 2 },
        { x: 150, y: 1260, size: 240, delay: 4 },
        { x: 930, y: 1400, size: 280, delay: 6 },
        { x: 540, y: 1700, size: 210, delay: 8 },
      ]}
    />
  </AbsoluteFill>
);
