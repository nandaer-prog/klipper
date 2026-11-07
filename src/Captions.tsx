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
          {page.tokens.map((t) => {
            const active = t.fromMs <= nowMs && nowMs < t.toMs;
            const strong = emph.has(norm(t.text));
            if (style === "box") {
              return (
                <span
                  key={t.fromMs}
                  style={{
                    display: "inline-block",
                    margin: "4px 0",
                    padding: "0 16px",
                    borderRadius: 18,
                    background: active ? accent : strong ? "rgba(255,61,141,.92)" : "transparent",
                    color: active ? "#111" : "#fff",
                    transform: active ? "scale(1.06)" : "none",
                  }}
                >
                  {t.text}
                </span>
              );
            }
            return (
              <span
                key={t.fromMs}
                style={{
                  display: "inline-block",
                  color: strong ? "#FF3D8D" : active ? accent : "#fff",
                  transform: `scale(${strong ? 1.16 : active ? 1.08 : 1})`,
                  transformOrigin: "50% 70%",
                }}
              >
                {t.text}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
