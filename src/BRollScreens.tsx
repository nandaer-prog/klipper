import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AppIcon } from "./AppIcon";
import { anton, montserrat } from "./fonts";
import type { AppIconName, BRollItem } from "./types";

type P = { item: BRollItem; durFrames: number; accent: string };

const useAnim = (durFrames: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 13, stiffness: 190 }, durationInFrames: 16 });
  const out = interpolate(frame, [durFrames - 8, durFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { frame, fps, enter, out };
};

/** Latar terang seperti layar aplikasi: putih di tengah, abu-abu di tepi. */
const LightBg: React.FC = () => (
  <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 38%, #ffffff 0%, #e9e9ee 55%, #bdbdc6 100%)" }} />
);

/** Layar tiruan prompt AI: judul, kotak input dengan teks diketik, lencana nomor merah. */
export const PromptScreen: React.FC<P> = ({ item, durFrames }) => {
  const { frame, enter, out } = useAnim(durFrames);
  const text = item.text;
  const typed = Math.floor(
    interpolate(frame, [10, Math.max(12, durFrames - 20)], [0, text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const caret = Math.floor(frame / 8) % 2 === 0;
  const badgePop = interpolate(frame, [4, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const chips = ["Buat gambar", "Tulis", "Cari tahu"];
  return (
    <AbsoluteFill style={{ opacity: out, transform: `scale(${interpolate(enter, [0, 1], [1.06, 1])})` }}>
      <LightBg />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 300 }}>
        <div style={{ fontFamily: montserrat, fontWeight: 700, fontSize: 56, color: "#2b2b33", textAlign: "center", maxWidth: 860 }}>
          {item.sub ?? "Apa yang sedang kamu kerjakan?"}
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 520,
          left: 90,
          width: 900,
          minHeight: 400,
          padding: "44px 44px 120px",
          borderRadius: 44,
          background: "#fff",
          boxShadow: "0 20px 60px rgba(0,0,0,.18)",
          border: "2px solid #e1e1e8",
        }}
      >
        {item.badge ? (
          <div
            style={{
              position: "absolute",
              top: -26,
              left: -26,
              width: 76,
              height: 76,
              borderRadius: "50%",
              background: "#E5252A",
              color: "#fff",
              fontFamily: anton,
              fontSize: 46,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${badgePop})`,
              boxShadow: "0 8px 18px rgba(229,37,42,.45)",
            }}
          >
            {item.badge}
          </div>
        ) : null}
        <div style={{ fontFamily: montserrat, fontWeight: 600, fontSize: 40, lineHeight: 1.3, color: "#2b2b33" }}>
          {text.slice(0, typed)}
          <span style={{ opacity: caret ? 1 : 0, color: "#2b2b33" }}>|</span>
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, bottom: 30, display: "flex", alignItems: "center", gap: 14 }}>
          {chips.map((c) => (
            <div key={c} style={{ fontFamily: montserrat, fontWeight: 600, fontSize: 26, color: "#6b6b76", padding: "10px 22px", borderRadius: 30, border: "2px solid #e1e1e8" }}>
              {c}
            </div>
          ))}
          <div style={{ marginLeft: "auto", width: 72, height: 72, borderRadius: "50%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="34" height="34" viewBox="0 0 24 24">
              <path d="M12 19V6M6 11l6-6 6 6" fill="none" stroke="#fff" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FLOAT_SPOTS: { x: number; y: number; r: number; s: number }[] = [
  { x: -30, y: -135, r: -10, s: 130 },
  { x: 800, y: -120, r: 12, s: 120 },
  { x: 880, y: 250, r: 8, s: 120 },
  { x: -40, y: 230, r: -8, s: 110 },
];

/** Kartu berita: sumber, headline, dan ikon aplikasi yang melayang di sudutnya. */
export const NewsCard: React.FC<P> = ({ item, durFrames, accent }) => {
  const { frame, enter, out } = useAnim(durFrames);
  const icons: AppIconName[] = item.icons?.length ? item.icons : ["chat", "spark"];
  const lift = interpolate(enter, [0, 1], [380, 0]);
  const burst = frame * 1.5;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", top: 900, left: 90, width: 900, transform: `translateY(${lift}px)` }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 30,
            padding: "30px 38px 36px",
            boxShadow: "0 18px 50px rgba(0,0,0,.4)",
            border: "4px solid #111",
          }}
        >
          {item.sub ? (
            <div style={{ fontFamily: montserrat, fontWeight: 700, fontSize: 28, color: "#6b6b76", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: accent, border: "3px solid #111", display: "inline-block" }} />
              {item.sub}
            </div>
          ) : null}
          <div style={{ fontFamily: montserrat, fontWeight: 900, fontSize: item.text.length > 40 ? 50 : 60, lineHeight: 1.12, color: "#111" }}>
            {item.text}
          </div>
        </div>
        {/* bintang dekoratif berputar */}
        <svg width="120" height="120" viewBox="0 0 24 24" style={{ position: "absolute", left: -40, top: 190, transform: `rotate(${burst}deg)` }}>
          <path d="M12 1l2.200 7.300L21 5l-3.300 6.800L23 12l-5.300.2L21 19l-6.800-3.300L12 23l-2.200-7.300L3 19l3.300-6.800L1 12l5.300-.2L3 5l6.800 3.300z" fill="#FF3D8D" />
        </svg>
        {icons.slice(0, FLOAT_SPOTS.length).map((name, i) => {
          const spot = FLOAT_SPOTS[i]!;
          const bob = Math.sin(frame / 9 + i * 2) * 10;
          return (
            <div
              key={name + i}
              style={{
                position: "absolute",
                left: spot.x,
                top: spot.y + bob,
                transform: `rotate(${spot.r + Math.sin(frame / 12 + i) * 4}deg) scale(${interpolate(enter, [0, 1], [0.3, 1])})`,
                filter: "drop-shadow(0 10px 18px rgba(0,0,0,.35))",
              }}
            >
              <AppIcon name={name} size={spot.s} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Ikon AI di tengah latar terang dengan ikon aplikasi yang mengorbit. */
export const OrbitScreen: React.FC<P> = ({ item, durFrames }) => {
  const { frame, enter, out } = useAnim(durFrames);
  const icons: AppIconName[] = item.icons?.length ? item.icons : ["sheet", "folder", "ads"];
  const cx = 540;
  const cy = 720;
  const radius = 330;
  return (
    <AbsoluteFill style={{ opacity: out, transform: `scale(${interpolate(enter, [0, 1], [1.06, 1])})` }}>
      <LightBg />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 260 }}>
        <div style={{ fontFamily: montserrat, fontWeight: 800, fontSize: 54, color: "#2b2b33", textAlign: "center", maxWidth: 860, textTransform: "uppercase" }}>
          {item.text}
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: cx - radius, top: cy - radius, width: radius * 2, height: radius * 2, borderRadius: "50%", border: "3px dashed rgba(0,0,0,.18)" }} />
      <div style={{ position: "absolute", left: cx - 120, top: cy - 120, transform: `scale(${1 + Math.sin(frame / 8) * 0.04})`, filter: "drop-shadow(0 14px 24px rgba(0,0,0,.3))" }}>
        <AppIcon name="chip" size={240} />
      </div>
      {icons.map((name, i) => {
        const angle = (i / icons.length) * Math.PI * 2 - Math.PI / 2 + frame * 0.035;
        return (
          <div
            key={name + i}
            style={{
              position: "absolute",
              left: cx + Math.cos(angle) * radius - 70,
              top: cy + Math.sin(angle) * radius - 70,
              filter: "drop-shadow(0 10px 18px rgba(0,0,0,.3))",
            }}
          >
            <AppIcon name={name} size={140} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
