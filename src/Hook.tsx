import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { anton } from "./fonts";

/** Judul hook di awal klip: meluncur masuk, tampil sebentar, lalu keluar. */
export const Hook: React.FC<{ title: string; accent: string; seconds?: number }> = ({
  title,
  accent,
  seconds = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = seconds * fps;
  if (!title || frame > total + 10) return null;

  const enter = spring({ frame, fps, config: { damping: 13, stiffness: 170 } });
  const exit = interpolate(frame, [total - 8, total], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(enter, [0, 1], [-260, 0]) - exit * 300;
  const size = title.length > 34 ? 66 : title.length > 22 ? 78 : 92;

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 210 }}>
      <div style={{ transform: `translateY(${y}px) rotate(${interpolate(enter, [0, 1], [-5, -1.5])}deg)` }}>
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
          {title}
        </div>
      </div>
    </AbsoluteFill>
  );
};
