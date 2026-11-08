import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { elite } from "./collageFonts";
import { clamp } from "./stopMotion";

const corner = (pos: React.CSSProperties, sides: { top?: boolean; left?: boolean }) => (
  <div
    style={{
      position: "absolute",
      width: 96,
      height: 96,
      ...pos,
      borderTop: sides.top ? "7px solid #fff" : undefined,
      borderBottom: sides.top ? undefined : "7px solid #fff",
      borderLeft: sides.left ? "7px solid #fff" : undefined,
      borderRight: sides.left ? undefined : "7px solid #fff",
      filter: "drop-shadow(0 2px 3px rgba(0,0,0,.6))",
    }}
  />
);

/**
 * Bingkai jendela bidik kamera (REC berkedip, timecode, baterai, garis scan) yang menutupi
 * layar sebentar, dengan gangguan VHS saat muncul dan hilang. Untuk momen "disadap/direkam".
 */
export const Viewfinder: React.FC<{ durFrames: number; startSec: number; seed: string }> = ({ durFrames, startSec, seed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [0, 2, durFrames - 3, durFrames], [0, 1, 1, 0], clamp);
  const noisy = frame < 5 || frame > durFrames - 5;
  const t = startSec + frame / fps;
  const tc = [Math.floor(t / 3600), Math.floor(t / 60) % 60, Math.floor(t) % 60, Math.floor((t % 1) * fps)]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  const recOn = Math.floor(frame / 15) % 2 === 0;
  const text: React.CSSProperties = { position: "absolute", fontFamily: elite, fontSize: 46, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,.8)", letterSpacing: 2 };
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0 2px, rgba(0,0,0,0) 2px 6px)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,.5) 100%)" }} />
      {noisy
        ? Array.from({ length: 7 }, (_, i) => {
            const r = (k: string) => random(`${seed}-${frame}-${i}-${k}`);
            return (
              <div
                key={i}
                style={{ position: "absolute", left: 0, right: 0, top: r("y") * 1920, height: 8 + r("h") * 46, background: `rgba(255,255,255,${0.15 + r("o") * 0.45})`, transform: `translateX(${(r("x") - 0.5) * 80}px)` }}
              />
            );
          })
        : null}
      {corner({ left: 60, top: 150 }, { top: true, left: true })}
      {corner({ right: 60, top: 150 }, { top: true, left: false })}
      {corner({ left: 60, bottom: 130 }, { top: false, left: true })}
      {corner({ right: 60, bottom: 130 }, { top: false, left: false })}
      <div style={{ ...text, left: 100, top: 196, display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ width: 34, height: 34, borderRadius: "50%", background: "#ff2d2d", opacity: recOn ? 1 : 0.15, boxShadow: "0 0 12px rgba(255,45,45,.8)" }} />
        REC
      </div>
      <div style={{ ...text, right: 100, top: 196, display: "flex", alignItems: "center", gap: 14 }}>
        HD
        <span style={{ display: "inline-block", width: 70, height: 34, border: "5px solid #fff", borderRadius: 6, position: "relative" }}>
          <span style={{ position: "absolute", left: 4, top: 4, bottom: 4, width: 38, background: "#fff" }} />
        </span>
      </div>
      <div style={{ ...text, left: 100, bottom: 176 }}>{tc}</div>
      {/* bidikan tengah */}
      <div style={{ position: "absolute", left: 540 - 40, top: 860, width: 80, height: 4, background: "rgba(255,255,255,.85)" }} />
      <div style={{ position: "absolute", left: 540 - 2, top: 862 - 40, width: 4, height: 80, background: "rgba(255,255,255,.85)" }} />
    </AbsoluteFill>
  );
};

/** Bocoran cahaya hangat yang menyapu layar (transisi untuk cutaway layar penuh). */
export const LightLeak: React.FC<{ durFrames: number; seed: string }> = ({ durFrames, seed }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, durFrames], [0, 1], clamp);
  const peak = interpolate(frame, [0, 3, durFrames * 0.5, durFrames], [0, 0.95, 0.7, 0], clamp);
  const fromLeft = random(seed) > 0.5;
  const x = interpolate(p, [0, 1], [-30, 130]);
  const px = fromLeft ? x : 100 - x;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", opacity: peak }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${px}% 30%, rgba(255,140,60,.95) 0%, rgba(255,80,40,.55) 25%, rgba(255,80,40,0) 55%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${fromLeft ? px - 20 : px + 20}% 75%, rgba(255,79,163,.85) 0%, rgba(255,79,163,0) 50%)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(${fromLeft ? 100 : 80}deg, rgba(255,210,63,0) ${px - 25}%, rgba(255,210,63,.6) ${px}%, rgba(255,210,63,0) ${px + 25}%)` }} />
    </AbsoluteFill>
  );
};
