import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { archivo } from "./collageFonts";
import { clamp, onTwos } from "./stopMotion";

const INK = "#111";

/** Lengan "rubber hose": kurva dari bahu ke tangan bersarung putih. */
const Arm: React.FC<{ sx: number; sy: number; deg: number; len?: number }> = ({ sx, sy, deg, len = 70 }) => {
  const r = (deg * Math.PI) / 180;
  const hx = sx + Math.cos(r) * len;
  const hy = sy + Math.sin(r) * len;
  const cx = sx + Math.cos(r + 0.45) * len * 0.7;
  const cy = sy + Math.sin(r + 0.45) * len * 0.7;
  return (
    <>
      <path d={`M${sx} ${sy} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)}`} fill="none" stroke={INK} strokeWidth={10} strokeLinecap="round" />
      <circle cx={hx} cy={hy} r={16} fill="#fff" stroke={INK} strokeWidth={5} />
    </>
  );
};

/**
 * Maskot uang kertas berwajah (kartun sederhana): berjalan masuk dari tepi layar,
 * berhenti, lalu melambai. Gerak "on twos" seperti animasi tangan.
 */
export const MoneyMascot: React.FC<{ side: "left" | "right"; durFrames: number }> = ({ side, durFrames }) => {
  const frame = useCurrentFrame();
  const q = onTwos(frame);
  const walking = q < 16;
  const x = interpolate(q, [0, 16], [-380, 0], clamp);
  const step = Math.floor(q / 4) % 2;
  const bob = walking ? (step ? -10 : 0) : Math.sin(q / 3) * 3;
  const out = interpolate(q, [durFrames - 8, durFrames - 2], [1, 0], clamp);
  const wave = -75 + Math.sin(q / 2.5) * 35;
  const frontArm = walking ? (step ? 50 : 80) : wave;
  const backArm = walking ? (step ? 120 : 95) : 110;
  const s = walking ? (step ? 1 : -1) : 0;
  return (
    <div style={{ width: 300, height: 340, transform: `translateX(${side === "left" ? x : -x}px) translateY(${bob}px) scale(${side === "left" ? 1 : -1}, 1) scale(${out})`, transformOrigin: "50% 100%" }}>
      <svg width={300} height={340} viewBox="0 0 300 340" style={{ overflow: "visible", filter: "drop-shadow(0 10px 10px rgba(0,0,0,.4))" }}>
        <Arm sx={74} sy={132} deg={backArm} />
        <path d={`M115 256 L${105 + s * 20} 318`} stroke={INK} strokeWidth={10} strokeLinecap="round" />
        <path d={`M175 256 L${185 - s * 20} 318`} stroke={INK} strokeWidth={10} strokeLinecap="round" />
        <ellipse cx={113 + s * 20} cy={322} rx={24} ry={11} fill={INK} />
        <ellipse cx={193 - s * 20} cy={322} rx={24} ry={11} fill={INK} />
        <rect x={70} y={40} width={150} height={220} rx={18} fill="#34c47c" stroke="#0f5132" strokeWidth={7} />
        <rect x={84} y={54} width={122} height={192} rx={10} fill="none" stroke="#0f5132" strokeWidth={3} strokeDasharray="8 6" />
        <circle cx={145} cy={92} r={26} fill="#a7f0c8" stroke="#0f5132" strokeWidth={3} />
        <text x={145} y={101} textAnchor="middle" fontFamily={archivo} fontSize={24} fill="#0f5132">
          Rp
        </text>
        <ellipse cx={125} cy={152} rx={13} ry={17} fill="#fff" stroke={INK} strokeWidth={4} />
        <ellipse cx={167} cy={152} rx={13} ry={17} fill="#fff" stroke={INK} strokeWidth={4} />
        <circle cx={129} cy={156} r={6} fill={INK} />
        <circle cx={171} cy={156} r={6} fill={INK} />
        <circle cx={108} cy={184} r={9} fill="#ff8fb8" opacity={0.8} />
        <circle cx={186} cy={184} r={9} fill="#ff8fb8" opacity={0.8} />
        <path d="M124 190 Q147 216 170 190" fill="#7a1f3d" stroke={INK} strokeWidth={6} strokeLinecap="round" />
        <Arm sx={216} sy={132} deg={frontArm} />
      </svg>
    </div>
  );
};

/**
 * Makhluk kartun ungu yang mengintip dari tepi bawah layar: naik, melirik kiri-kanan,
 * berkedip, lalu turun lagi. Untuk momen "diintip/diawasi".
 */
export const PeekingBuddy: React.FC<{ durFrames: number }> = ({ durFrames }) => {
  const frame = useCurrentFrame();
  const q = onTwos(frame);
  const rise = interpolate(q, [0, 6, 8, 10], [300, -16, 6, 0], clamp) + interpolate(q, [durFrames - 10, durFrames - 2], [0, 320], clamp);
  const look = interpolate(q, [10, 14, 22, 26, 34, 38], [0, -20, -20, 20, 20, 0], clamp);
  const lookY = q >= 34 ? 6 : 0;
  const blink = q >= 28 && q < 32 ? 0.1 : 1;
  return (
    <div style={{ width: 340, height: 300, transform: `translateY(${rise}px)` }}>
      <svg width={340} height={330} viewBox="0 0 340 330" style={{ overflow: "visible", filter: "drop-shadow(0 -6px 12px rgba(0,0,0,.35))" }}>
        <path d="M150 42 Q140 0 112 6 M190 42 Q204 2 232 10" fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" />
        <ellipse cx={170} cy={190} rx={152} ry={150} fill="#7a5cff" stroke="#1a1a2e" strokeWidth={8} />
        <g transform={`translate(0 ${170}) scale(1 ${blink}) translate(0 ${-170})`}>
          {[115, 225].map((ex) => (
            <g key={ex}>
              <circle cx={ex} cy={170} r={46} fill="#fff" stroke="#1a1a2e" strokeWidth={6} />
              <circle cx={ex + look} cy={174 + lookY} r={21} fill={INK} />
              <circle cx={ex + look + 8} cy={166 + lookY} r={7} fill="#fff" />
            </g>
          ))}
        </g>
        <path d="M140 250 Q170 236 200 250" fill="none" stroke="#1a1a2e" strokeWidth={7} strokeLinecap="round" />
        {[46, 294].map((hx) => (
          <g key={hx}>
            <rect x={hx - 40} y={262} width={80} height={56} rx={26} fill="#7a5cff" stroke="#1a1a2e" strokeWidth={7} />
            {[-14, 0, 14].map((fx) => (
              <line key={fx} x1={hx + fx} y1={268} x2={hx + fx} y2={288} stroke="#1a1a2e" strokeWidth={4} strokeLinecap="round" />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
};
