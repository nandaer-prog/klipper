import { createTikTokStyleCaptions } from "@remotion/captions";
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ClipProps } from "./types";

const Captions: React.FC<{ captions: ClipProps["captions"] }> = ({
  captions,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;

  const { pages } = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions,
        combineTokensWithinMilliseconds: 1000,
      }),
    [captions],
  );

  const page = [...pages].reverse().find((p) => p.startMs <= nowMs);
  if (!page) return null;
  const pageEnd = page.startMs + page.durationMs;
  if (nowMs > pageEnd + 200) return null;

  const pop = spring({
    frame: frame - Math.round((page.startMs / 1000) * fps),
    fps,
    config: { damping: 14, stiffness: 200 },
    durationInFrames: 12,
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 380,
        paddingLeft: 60,
        paddingRight: 60,
      }}
    >
      <div
        style={{
          transform: `scale(${interpolate(pop, [0, 1], [0.85, 1])})`,
          fontFamily: "Impact, 'Arial Black', sans-serif",
          fontSize: 82,
          lineHeight: 1.15,
          textAlign: "center",
          textTransform: "uppercase",
          whiteSpace: "pre-wrap",
          WebkitTextStroke: "10px black",
          paintOrder: "stroke fill",
        }}
      >
        {page.tokens.map((t) => {
          const active = t.fromMs <= nowMs && nowMs < t.toMs;
          return (
            <span key={t.fromMs} style={{ color: active ? "#FFE600" : "#fff" }}>
              {t.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const ClipVideo: React.FC<ClipProps> = ({
  src,
  captions,
  title,
  layout,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!src) {
    return null;
  }

  const url = staticFile(src);

  const titleIn = spring({ frame, fps, config: { damping: 200 } });
  const showTitle = title && frame < fps * 3;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {layout === "blur-fit" ? (
        <>
          <AbsoluteFill style={{ filter: "blur(40px) brightness(0.6)" }}>
            <OffthreadVideo
              src={url}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AbsoluteFill>
          <AbsoluteFill style={{ justifyContent: "center" }}>
            <OffthreadVideo
              src={url}
              style={{ width: "100%", objectFit: "contain" }}
            />
          </AbsoluteFill>
        </>
      ) : (
        <OffthreadVideo
          src={url}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      {showTitle ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            paddingTop: 220,
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [-30, 0])}px)`,
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.65)",
              color: "#fff",
              fontFamily: "Arial, sans-serif",
              fontWeight: 800,
              fontSize: 54,
              padding: "20px 36px",
              borderRadius: 24,
              maxWidth: 900,
              textAlign: "center",
            }}
          >
            {title}
          </div>
        </AbsoluteFill>
      ) : null}

      <Captions captions={captions} />
    </AbsoluteFill>
  );
};
