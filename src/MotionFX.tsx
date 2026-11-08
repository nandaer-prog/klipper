import type { Caption } from "@remotion/captions";
import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Icon } from "./Icons";
import type { BRollItem, IconName } from "./types";
import { emphasisBeats, iconForWord, normWord, toWords } from "./wordIcons";

type Sticker = { at: number; icon: IconName; side: "left" | "right" };

/**
 * Stiker ikon pada kata penting (emphasis) dan kata bermakna kuat (uang, presiden, bahaya...).
 * Dilewati saat hook tampil, saat B-roll aktif, dan dijaga minimal `gap` detik antar stiker.
 */
export const buildStickers = (
  captions: Caption[],
  emphasis: string[],
  broll: BRollItem[],
  opts: { skipBefore: number; gap?: number },
): Sticker[] => {
  const gap = opts.gap ?? 3;
  const emphAt = new Set(emphasisBeats(captions, emphasis));
  const busy = (t: number) => broll.some((b) => t >= b.at - 0.4 && t <= b.at + b.dur + 0.4);
  const out: Sticker[] = [];
  for (const w of toWords(captions)) {
    const t = w.startMs / 1000;
    const matched = iconForWord(w.text);
    const isEmph = emphAt.has(t);
    if ((!isEmph && !(matched && normWord(w.text).length >= 5)) || t < opts.skipBefore || busy(t)) continue;
    if (out.length && t - out[out.length - 1]!.at < gap) continue;
    out.push({ at: t, icon: matched ?? "star", side: out.length % 2 === 0 ? "right" : "left" });
  }
  return out;
};

/** Garis-garis ledakan (burst) di belakang stiker. */
const Burst: React.FC<{ color: string; t: number }> = ({ color, t }) => {
  const rays = 10;
  const len = interpolate(t, [0, 0.35, 1], [0, 1, 0.6], { extrapolateRight: "clamp" });
  const fade = interpolate(t, [0.5, 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <svg width={340} height={340} viewBox="-170 -170 340 340" style={{ position: "absolute", left: -70, top: -70, opacity: fade }}>
      {Array.from({ length: rays }, (_, i) => {
        const a = (i / rays) * Math.PI * 2;
        const r0 = 95 + 25 * len;
        const r1 = r0 + 45 * len;
        return (
          <line
            key={i}
            x1={Math.cos(a) * r0}
            y1={Math.sin(a) * r0}
            x2={Math.cos(a) * r1}
            y2={Math.sin(a) * r1}
            stroke={i % 2 ? "#fff" : color}
            strokeWidth={10}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};

const StickerPop: React.FC<{ s: Sticker; accent: string; durFrames: number }> = ({ s, accent, durFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 240 }, durationInFrames: 14 });
  const out = interpolate(frame, [durFrames - 7, durFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wobble = Math.sin(frame / 4) * 6;
  const dir = s.side === "right" ? 1 : -1;
  return (
    <div
      style={{
        // setinggi dada, tepat di atas caption: hampir tidak pernah menutupi wajah
        position: "absolute",
        top: 950,
        [s.side]: 60,
        width: 200,
        height: 200,
        opacity: out,
        transform: `scale(${pop * (0.9 + out * 0.1)}) rotate(${dir * 10 + wobble}deg)`,
        filter: "drop-shadow(0 12px 18px rgba(0,0,0,.45))",
      }}
    >
      <Burst color={accent} t={frame / durFrames} />
      <Icon name={s.icon} size={200} color={accent} />
    </div>
  );
};

/** Kilatan putih + garis kecepatan sesaat ketika B-roll masuk, agar pergantian terasa menghentak. */
const EntryFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [0, 1, 5], [0, 0.55, 0], { extrapolateRight: "clamp" });
  const lines = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
      <svg width={1080} height={1920} style={{ position: "absolute", opacity: 1 - lines }}>
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          const r0 = 500 + lines * 600;
          return (
            <line
              key={i}
              x1={540 + Math.cos(a) * r0}
              y1={960 + Math.sin(a) * r0}
              x2={540 + Math.cos(a) * (r0 + 420)}
              y2={960 + Math.sin(a) * (r0 + 420)}
              stroke="#fff"
              strokeWidth={8}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** Lapisan motion graphic otomatis: stiker ikon pada kata penting + kilatan saat B-roll masuk. */
export const MotionFX: React.FC<{
  captions: Caption[];
  emphasis: string[];
  broll: BRollItem[];
  accent: string;
  hook: boolean;
}> = ({ captions, emphasis, broll, accent, hook }) => {
  const { fps } = useVideoConfig();
  const stickers = buildStickers(captions, emphasis, broll, { skipBefore: hook ? 3.4 : 0.5 });
  const stickerFrames = Math.round(1.3 * fps);
  return (
    <>
      {stickers.map((s) => (
        <Sequence key={`st-${s.at}`} from={Math.round(s.at * fps)} durationInFrames={stickerFrames} layout="none">
          <StickerPop s={s} accent={accent} durFrames={stickerFrames} />
        </Sequence>
      ))}
      {broll.map((b, i) => (
        <Sequence key={`fl-${b.at}-${i}`} from={Math.round(b.at * fps)} durationInFrames={10} layout="none">
          <EntryFlash />
        </Sequence>
      ))}
    </>
  );
};
