import { createTikTokStyleCaptions, type Caption } from "@remotion/captions";
import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { montserrat } from "./fonts";
import type { CaptionStyle } from "./types";

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

type Props = {
  captions: Caption[];
  emphasis: string[];
  style: CaptionStyle;
  accent: string;
};

export const Captions: React.FC<Props> = ({ captions, emphasis, style, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;

  const { pages } = useMemo(
    () => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 650 }),
    [captions],
  );
  const emph = useMemo(() => new Set(emphasis.map(norm).filter(Boolean)), [emphasis]);

  const page = [...pages].reverse().find((p) => p.startMs <= nowMs);
  if (!page || nowMs > page.startMs + page.durationMs + 250) return null;

  // sub-token Whisper tanpa spasi di depan menempel ke kata sebelumnya: satu kata tidak boleh terpecah baris
  const words: { key: number; text: string; fromMs: number; toMs: number }[] = [];
  page.tokens.forEach((t, i) => {
    if (i === 0 || /^\s/.test(t.text) || words.length === 0) {
      words.push({ key: t.fromMs, text: t.text.trim(), fromMs: t.fromMs, toMs: t.toMs });
    } else {
      const w = words[words.length - 1]!;
      w.text += t.text;
      w.toMs = t.toMs;
    }
  });

  const pop = spring({
    frame: frame - Math.round((page.startMs / 1000) * fps),
    fps,
    config: { damping: 11, stiffness: 240 },
    durationInFrames: 12,
  });
  const scale = interpolate(pop, [0, 1], [0.82, 1]);
  const lift = interpolate(pop, [0, 1], [24, 0]);

  const base: React.CSSProperties = {
    fontFamily: montserrat,
    textAlign: "center",
    lineHeight: 1.12,
    textTransform: "uppercase",
    whiteSpace: "pre-wrap",
    maxWidth: 940,
  };

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 1190 }}>
      <div style={{ transform: `translateY(${lift}px) scale(${scale})` }}>
        <div
          style={
            style === "clean"
              ? { ...base, fontWeight: 800, fontSize: 74, color: "#fff", textShadow: "0 4px 18px rgba(0,0,0,.65), 0 2px 4px rgba(0,0,0,.6)" }
              : style === "box"
                ? { ...base, fontWeight: 900, fontSize: 80, color: "#fff", textShadow: "0 4px 14px rgba(0,0,0,.7)" }
                : { ...base, fontWeight: 900, fontSize: 92, color: "#fff", WebkitTextStroke: "14px #000", paintOrder: "stroke fill", textShadow: "0 8px 0 rgba(0,0,0,.35)" }
          }
        >
          {words.map((w) => {
            const active = w.fromMs <= nowMs && nowMs < w.toMs;
            const strong = emph.has(norm(w.text));
            const wordStyle: React.CSSProperties = {
              display: "inline-block",
              whiteSpace: "nowrap",
              margin: "4px 0.2em",
            };
            if (style === "box") {
              return (
                <span
                  key={w.key}
                  style={{
                    ...wordStyle,
                    padding: "0 16px",
                    borderRadius: 18,
                    background: active ? accent : strong ? "rgba(255,61,141,.92)" : "transparent",
                    color: active ? "#111" : "#fff",
                    transform: active ? "scale(1.06)" : "none",
                  }}
                >
                  {w.text}
                </span>
              );
            }
            return (
              <span
                key={w.key}
                style={{
                  ...wordStyle,
                  color: strong ? "#FF3D8D" : active ? accent : "#fff",
                  transform: `scale(${strong ? 1.16 : active ? 1.08 : 1})`,
                  transformOrigin: "50% 70%",
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
