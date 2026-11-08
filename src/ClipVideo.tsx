import React, { useMemo } from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRollLayer } from "./BRoll";
import { Captions } from "./Captions";
import { Hook } from "./Hook";
import { MotionFX } from "./MotionFX";
import { emphasisBeats } from "./wordIcons";
import type { ClipProps } from "./types";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const FACE_Y = 0.4; // wajah ditempatkan di 40% tinggi frame

const CameraVideo: React.FC<Pick<ClipProps, "src" | "srcWidth" | "srcHeight" | "camera">> = ({
  src,
  srcWidth,
  srcHeight,
  camera,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const base = Math.max(width / srcWidth, height / srcHeight);
  const f = camera ? Math.min(frame, camera.z.length - 1) : 0;
  const z = camera?.z[f] ?? 1;
  const cx = camera?.cx[f] ?? srcWidth / 2;
  const cy = camera?.cy[f] ?? srcHeight / 2;
  const s = base * z;
  // titik (cx, cy) di video sumber dibawa ke posisi wajah di frame, lalu dijepit agar tidak ada tepi kosong
  const left = clamp(width / 2 - cx * s, width - srcWidth * s, 0);
  const top = clamp(height * FACE_Y - cy * s, height - srcHeight * s, 0);
  return (
    <OffthreadVideo
      src={staticFile(src)}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: srcWidth,
        height: srcHeight,
        transformOrigin: "0 0",
        transform: `translate(${left}px, ${top}px) scale(${s})`,
      }}
    />
  );
};

export const ClipVideo: React.FC<ClipProps> = (props) => {
  const { src, mode, camera, captions, emphasis, captionStyle, title, hook, broll, accent } = props;
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const beats = useMemo(() => emphasisBeats(captions, emphasis), [captions, emphasis]);

  if (!src) {
    return null;
  }

  // mode komposit tidak punya kamera pintar: beri dentuman zoom singkat di kata penting
  const t = frame / fps;
  const punch = beats.reduce((m, b) => {
    const since = t - b;
    return since >= 0 && since < 0.4 ? Math.max(m, 0.07 * (1 - since / 0.4)) : m;
  }, 0);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {mode === "camera" ? (
        <CameraVideo src={src} srcWidth={props.srcWidth} srcHeight={props.srcHeight} camera={camera} />
      ) : (
        <OffthreadVideo
          src={staticFile(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1 + punch})` }}
        />
      )}

      {/* gradasi agar caption dan judul mudah dibaca */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,.42) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 58%, rgba(0,0,0,.55) 100%)",
        }}
      />

      <BRollLayer items={broll} accent={accent} />
      <MotionFX captions={captions} emphasis={emphasis} broll={broll} accent={accent} hook={hook && !!title} />
      {hook ? <Hook title={title} accent={accent} emphasis={emphasis} /> : null}
      <Captions captions={captions} emphasis={emphasis} style={captionStyle} accent={accent} />

      {/* bilah progres tipis di atas */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 10,
          width: `${(frame / Math.max(1, durationInFrames)) * 100}%`,
          background: accent,
        }}
      />
    </AbsoluteFill>
  );
};
