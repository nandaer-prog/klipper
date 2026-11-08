import React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import { Icon } from "./Icons";
import { RISO } from "./Riso";
import { clamp, jitter, onTwos, svgId } from "./stopMotion";
import type { IconName } from "./types";

/** Tepi kertas sobek berbentuk lonjong (path SVG di kotak w x h). */
export const tornBlob = (seed: string, w: number, h: number, jag = 12) => {
  const n = 44;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 - random(`${seed}-${i}`) * ((jag * 2) / Math.min(w, h));
    pts.push(`${(w / 2 + (Math.cos(a) * w * r) / 2).toFixed(1)},${(h / 2 + (Math.sin(a) * h * r) / 2).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
};

/** Sobekan kertas persegi panjang dengan tepi bergerigi. */
export const tornRect = (seed: string, w: number, h: number, jag = 10) => {
  const pts: string[] = [];
  const step = 18;
  let i = 0;
  const push = (x: number, y: number) => {
    pts.push(`${(x + (random(`${seed}-x${i}`) - 0.5) * jag).toFixed(1)},${(y + (random(`${seed}-y${i}`) - 0.5) * jag).toFixed(1)}`);
    i++;
  };
  for (let x = 0; x <= w; x += step) push(x, 0);
  for (let y = step; y <= h; y += step) push(w, y);
  for (let x = w - step; x >= 0; x -= step) push(x, h);
  for (let y = h - step; y > 0; y -= step) push(0, y);
  return `M${pts.join(" L")} Z`;
};

/** Filter SVG bersama: tepi putih "die-cut" seperti stiker. Dipasang sekali per komposisi. */
export const CollageDefs: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <defs>
      <filter id="dieCut" x="-25%" y="-25%" width="150%" height="150%">
        <feMorphology in="SourceAlpha" operator="dilate" radius={9} result="fat" />
        <feFlood floodColor="#ffffff" result="white" />
        <feComposite in="white" in2="fat" operator="in" result="border" />
        <feMerge>
          <feMergeNode in="border" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  </svg>
);

/** Masuk seperti stiker ditempel: besar-kecil "on twos", lalu bergetar halus. */
const useSlap = (seed: string, durFrames: number) => {
  const frame = useCurrentFrame();
  const q = onTwos(frame);
  const scale = interpolate(q, [0, 2, 4, 6], [1.4, 0.88, 1.06, 1], clamp);
  const kick = q === 0 ? 14 : q === 2 ? -5 : 0;
  const shake = q >= 6 ? jitter(`${seed}-j`, frame) * 2 : 0;
  const out = interpolate(frame, [durFrames - 6, durFrames], [1, 0], clamp);
  return { frame, q, scale, rot: kick + shake, out };
};

/** Stiker kolase: ikon ber-tepi putih di atas sobekan kertas berwarna dan tambalan titik halftone. */
export const CollageSticker: React.FC<{ icon: IconName; accent: string; seed: string; durFrames: number }> = ({ icon, accent, seed, durFrames }) => {
  const { scale, rot, out } = useSlap(seed, durFrames);
  const base = (random(`${seed}-r`) - 0.5) * 24;
  const back = [RISO.pink, RISO.teal, RISO.yellow, RISO.purple][Math.floor(random(`${seed}-b`) * 4)]!;
  const id = svgId(seed);
  return (
    <div style={{ position: "relative", width: 260, height: 260, opacity: out, transform: `scale(${scale}) rotate(${base + rot}deg)` }}>
      <svg width={300} height={300} viewBox="0 0 300 300" style={{ position: "absolute", left: -20, top: -20, overflow: "visible" }}>
        <defs>
          <pattern id={`${id}-ht`} width={12} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
            <circle cx={6} cy={6} r={3.2} fill="#111" />
          </pattern>
        </defs>
        <path d={tornBlob(`${seed}-t`, 270, 250, 16)} transform="translate(15 28)" fill={back} />
        <path d={tornBlob(`${seed}-h`, 150, 140, 12)} transform="translate(150 6)" fill="#fff" />
        <path d={tornBlob(`${seed}-h`, 150, 140, 12)} transform="translate(150 6)" fill={`url(#${id}-ht)`} opacity={0.75} />
      </svg>
      <div style={{ position: "absolute", left: 30, top: 30, filter: "url(#dieCut) drop-shadow(0 10px 12px rgba(0,0,0,.4))" }}>
        <Icon name={icon} size={200} color={accent} />
      </div>
    </div>
  );
};

const EYE = "M-120 0 Q0 -78 120 0 Q0 78 -120 0 Z";
const lidY = (x: number) => {
  const t = (x / 124 + 1) / 2;
  return 2 - 172 * t * (1 - t);
};

const Eye: React.FC<{ cx: number; cy: number; look: number; blink: number; id: string; browTilt: number }> = ({ cx, cy, look, blink, id, browTilt }) => (
  <g transform={`translate(${cx} ${cy})`}>
    <path d={`M-118 ${-98 + browTilt} L112 ${-98 - browTilt}`} stroke="#111" strokeWidth={18} strokeLinecap="round" />
    <g transform={`scale(1 ${blink})`}>
      <path d={EYE} fill="#f4f2ee" stroke="#111" strokeWidth={7} />
      <g clipPath={`url(#${id}-clip)`}>
        <circle cx={look} cy={4} r={46} fill="#2a6f73" />
        <circle cx={look} cy={4} r={46} fill={`url(#${id}-dots)`} />
        <circle cx={look} cy={4} r={20} fill="#111" />
        <circle cx={look + 12} cy={-8} r={7} fill="#fff" />
        <path d="M-120 0 Q0 -78 120 0" fill="none" stroke="rgba(0,0,0,.22)" strokeWidth={24} />
      </g>
      <path d="M-124 2 Q0 -86 124 2" fill="none" stroke="#111" strokeWidth={11} strokeLinecap="round" />
      {[-84, -42, 0, 42, 84].map((x) => (
        <line key={x} x1={x} y1={lidY(x)} x2={x * 1.12} y2={lidY(x) - 24} stroke="#111" strokeWidth={6} strokeLinecap="round" />
      ))}
    </g>
  </g>
);

/**
 * Sepasang mata kolase (ilustrasi bertitik halftone) di sobekan kertas yang glitch:
 * melirik kiri-kanan, berkedip, dan potongan horizontalnya sesekali bergeser.
 */
export const GlitchEyes: React.FC<{ seed: string; durFrames: number }> = ({ seed, durFrames }) => {
  const { frame, q, scale, rot, out } = useSlap(seed, durFrames);
  const id = svgId(seed);
  const look = interpolate(q, [4, 10, 18, 26, 34], [0, -24, -24, 24, 24], clamp);
  const blink = q >= 20 && q < 24 ? 0.12 : 1;
  const tick = Math.floor(frame / 2);
  const glitch = q < 4 || random(`${seed}-g-${tick}`) > 0.72;
  const W = 680;
  const H = 270;
  const bands = [
    [0, 105],
    [105, 165],
    [165, H],
  ] as const;
  const eyes = (
    <>
      <Eye cx={175} cy={150} look={look} blink={blink} id={id} browTilt={-10} />
      <Eye cx={505} cy={150} look={look} blink={blink} id={id} browTilt={10} />
    </>
  );
  return (
    <div style={{ width: W, height: H, opacity: out, transform: `scale(${scale}) rotate(${-3 + rot}deg)`, filter: "drop-shadow(0 12px 14px rgba(0,0,0,.45))" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        <defs>
          <clipPath id={`${id}-clip`}>
            <path d={EYE} />
          </clipPath>
          <pattern id={`${id}-dots`} width={8} height={8} patternUnits="userSpaceOnUse">
            <circle cx={4} cy={4} r={2.2} fill="rgba(0,0,0,.55)" />
          </pattern>
          <pattern id={`${id}-paper`} width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <circle cx={5} cy={5} r={1.6} fill="rgba(0,0,0,.14)" />
          </pattern>
          {bands.map(([y0, y1], i) => (
            <clipPath key={i} id={`${id}-band${i}`}>
              <rect x={-60} y={y0} width={W + 120} height={y1 - y0} />
            </clipPath>
          ))}
        </defs>
        <path d={tornRect(`${seed}-pink`, W + 40, H + 30, 18)} transform="translate(-20 -15)" fill={RISO.pink} />
        <path d={tornRect(`${seed}-paper`, W - 20, H - 40, 12)} transform="translate(10 20)" fill="#f4f1ea" />
        <path d={tornRect(`${seed}-paper`, W - 20, H - 40, 12)} transform="translate(10 20)" fill={`url(#${id}-paper)`} />
        {glitch ? (
          <g opacity={0.7}>
            <g transform="translate(-9 0)" style={{ mixBlendMode: "multiply" }}>
              <path d="M51 152 Q175 64 299 152 M381 152 Q505 64 629 152" fill="none" stroke="#00e5ff" strokeWidth={12} />
            </g>
            <g transform="translate(9 0)" style={{ mixBlendMode: "multiply" }}>
              <path d="M51 152 Q175 64 299 152 M381 152 Q505 64 629 152" fill="none" stroke="#ff2bd6" strokeWidth={12} />
            </g>
          </g>
        ) : null}
        {bands.map((_, i) => (
          <g key={i} clipPath={`url(#${id}-band${i})`} transform={`translate(${glitch ? (random(`${seed}-s${i}-${tick}`) - 0.5) * 50 : 0} 0)`}>
            {eyes}
          </g>
        ))}
      </svg>
    </div>
  );
};
