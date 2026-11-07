import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { anton } from "./fonts";

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Pilih satu kata untuk disorot: kata pertama yang ada di emphasis, jika tidak ada kata terpanjang. */
const pickHighlight = (words: string[], emphasis: string[]): number => {
  const emph = new Set(emphasis.map(norm).filter(Boolean));
  const hit = words.findIndex((w) => emph.has(norm(w)));
  if (hit >= 0) return hit;
  let best = -1;
  words.forEach((w, i) => {
    if (norm(w).length >= 5 && (best < 0 || norm(w).length > norm(words[best]!).length)) best = i;
  });
  return best;
};

/** Judul hook di awal klip: menghentak masuk, satu kata kunci disorot, lalu keluar. */
export const Hook: React.FC<{ title: string; accent: string; emphasis?: string[]; seconds?: number }> = ({
  title,
  accent,
  emphasis = [],
  seconds = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = seconds * fps;
  if (!title || frame > total + 10) return null;

  // pegas lebih keras dan meluncur dari atas: terasa menghentak
  const enter = spring({ frame, fps, config: { damping: 10, stiffness: 260 } });
  const exit = interpolate(frame, [total - 8, total], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(enter, [0, 1], [-320, 0]) - exit * 300;
  const scale = interpolate(enter, [0, 1], [0.7, 1]);
  const size = title.length > 34 ? 66 : title.length > 22 ? 78 : 92;

  const words = title.split(/\s+/).filter(Boolean);
  const hl = pickHighlight(words, emphasis);
  // kata sorotan berdenyut halus agar mata tertarik ke sana
  const pulse = 1 + Math.sin(frame / 4) * 0.04;

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 210 }}>
      <div style={{ transform: `translateY(${y}px) scale(${scale}) rotate(${interpolate(enter, [0, 1], [-7, -1.5])}deg)` }}>
        <div
          style={{
            background: accent,
            color: "#111",
            fontFamily: anton,
            fontSize: size,
            lineHeight: 1.08,
            textTransform: "uppercase",
            textAlign: "center",
            padding: "20px 38px 24px",
            borderRadius: 22,
            maxWidth: 940,
            boxShadow: "0 10px 0 #111, 0 22px 40px rgba(0,0,0,.35)",
            border: "5px solid #111",
          }}
        >
          {words.map((w, i) =>
            i === hl ? (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  background: "#111",
                  color: accent,
                  borderRadius: 14,
                  padding: "0 14px",
                  margin: "0 4px",
                  transform: `scale(${pulse})`,
                }}
              >
                {w}
              </span>
            ) : (
              <span key={i}>{i > 0 ? " " : ""}{w}{i < words.length - 1 ? " " : ""}</span>
            ),
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
