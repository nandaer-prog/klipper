import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { anton, montserrat } from "./fonts";
import type { BRollItem } from "./types";

/**
 * Variasi animasi B-roll keyword (terinspirasi template Jitter):
 * stretch = teks melebar lalu "jepret" ke ukuran normal, snap = blok teks berkedip mengikuti ketukan,
 * glitch = huruf muncul acak dengan efek RGB terbelah.
 */
export type KeywordVariant = "stretch" | "snap" | "glitch";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const GLYPHS = "#%&*$@!?X0123456789";
/** Pola kedip untuk "snap": 1 = tampil, 0 = hilang, per frame di awal. */
const STROBE = [1, 1, 1, 0, 0, 1, 1, 0, 1];

/** Bungkus kata menjadi baris pendek (maks ~maxChars huruf per baris). */
const toLines = (text: string, maxChars: number) => {
  const lines: string[] = [];
  for (const w of text.toUpperCase().split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last && `${last} ${w}`.length <= maxChars) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  return lines.length ? lines : [text.toUpperCase()];
};

export const KeywordFX: React.FC<{ item: BRollItem; durFrames: number; accent: string; variant: KeywordVariant }> = ({
  item,
  durFrames,
  accent,
  variant,
}) => {
  const frame = useCurrentFrame();
  const lines = toLines(item.text, 12);
  const longest = Math.max(...lines.map((l) => l.length));
  const fontSize = longest <= 7 ? 150 : longest <= 10 ? 124 : longest <= 14 ? 100 : 84;
  const out = interpolate(frame, [durFrames - 8, durFrames], [1, 0], clamp);
  const subIn = interpolate(frame, [8, 16], [0, 1], clamp);
  const strobeOn = variant !== "snap" || frame >= STROBE.length || STROBE[frame] === 1;
  const kick = variant === "snap" ? (frame < 3 ? 1.14 : frame < 7 ? 1.05 : 1) : 1;

  const base: React.CSSProperties = { fontFamily: anton, fontSize, lineHeight: 1.04, textTransform: "uppercase", whiteSpace: "nowrap" };
  const stroked: React.CSSProperties = { WebkitTextStroke: "12px #111", paintOrder: "stroke fill" };

  const renderLine = (line: string, i: number) => {
    const color = i % 2 ? accent : "#fff";
    if (variant === "stretch") {
      // tahan melebar ~4 frame, lalu "jepret" ke ukuran normal dengan sedikit pantulan
      const f = frame - i * 3;
      const sx = interpolate(f, [0, 4, 7, 10, 13], [2.4, 2.1, 0.86, 1.05, 1], clamp);
      const sy = interpolate(f, [0, 4, 7, 10, 13], [0.42, 0.5, 1.14, 0.97, 1], clamp);
      return (
        <div
          key={i}
          style={{
            ...base,
            ...stroked,
            color,
            textShadow: "0 10px 0 rgba(0,0,0,.35)",
            opacity: f >= 0 ? 1 : 0,
            transform: `scale(${sx}, ${sy})`,
          }}
        >
          {line}
        </div>
      );
    }
    if (variant === "snap") {
      return (
        <div
          key={i}
          style={{
            ...base,
            display: "inline-block",
            color: i % 2 ? accent : "#111",
            background: i % 2 ? "#111" : accent,
            padding: "4px 30px 10px",
            borderRadius: 18,
            marginTop: i ? 12 : 0,
            transform: `rotate(${i % 2 ? 2 : -2}deg)`,
            boxShadow: "0 12px 0 rgba(0,0,0,.35)",
          }}
        >
          {line}
        </div>
      );
    }
    // glitch: tiap huruf muncul di frame acak, sempat jadi simbol acak, dengan bayangan RGB terbelah
    const amp = frame < 14 ? (1 - frame / 14) * 14 : random(`${item.text}-spike-${Math.floor(frame / 5)}`) > 0.85 ? 7 : 0;
    const jx = frame < 12 && random(`${item.text}-jx-${i}-${frame}`) > 0.6 ? (random(`${item.text}-jv-${i}-${frame}`) - 0.5) * 40 : 0;
    return (
      <div
        key={i}
        style={{
          ...base,
          ...stroked,
          color,
          transform: `translateX(${jx}px)`,
          textShadow: `${amp}px 0 0 #ff2bd6, ${-amp}px 0 0 #00e5ff, 0 10px 0 rgba(0,0,0,.35)`,
        }}
      >
        {[...line].map((ch, k) => {
          if (ch === " ") return <span key={k}> </span>;
          const seed = `${item.text}-${i}-${k}`;
          const reveal = Math.floor(random(seed) * 10) + i * 2;
          if (frame < reveal) return <span key={k} style={{ opacity: 0 }}>{ch}</span>;
          const glyph = frame < reveal + 3 ? GLYPHS[Math.floor(random(`${seed}-${frame}`) * GLYPHS.length)] : ch;
          return <span key={k}>{glyph}</span>;
        })}
      </div>
    );
  };

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        // setinggi dada (di bawah wajah, di atas caption)
        paddingTop: Math.round(1000 - lines.length * fontSize * 0.55),
        opacity: out,
        visibility: strobeOn ? "visible" : "hidden",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${kick})` }}>
        {lines.map(renderLine)}
        {item.sub ? (
          <div
            style={{
              fontFamily: montserrat,
              fontWeight: 900,
              fontSize: 40,
              color: "#fff",
              marginTop: 18,
              textTransform: "uppercase",
              textShadow: "0 4px 14px rgba(0,0,0,.85)",
              opacity: subIn,
              transform: `translateY(${(1 - subIn) * 20}px)`,
            }}
          >
            {item.sub}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
