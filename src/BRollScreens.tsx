import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
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

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Pusat tombol kirim di layar prompt (kartu: left 90, top 520, lebar 900, tinggi 460). */
const SEND_BTN = { x: 914, y: 914 };

/** Latar lembut bergradasi ungu-biru yang bergerak pelan. */
const SoftBg: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ background: "#f3f2f8" }}>
    <div style={{ position: "absolute", left: 40 + Math.sin(frame / 30) * 60, top: 260 + Math.cos(frame / 34) * 50, width: 820, height: 820, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,.55) 0%, rgba(167,139,250,0) 70%)" }} />
    <div style={{ position: "absolute", left: 260 + Math.cos(frame / 28) * 70, top: 760 + Math.sin(frame / 32) * 60, width: 860, height: 860, borderRadius: "50%", background: "radial-gradient(circle, rgba(125,170,255,.5) 0%, rgba(125,170,255,0) 70%)" }} />
  </AbsoluteFill>
);

/**
 * Layar tiruan prompt AI: teks diketik di kotak kaca, lalu kamera mendorong ke tombol kirim
 * dan kursor "mengklik" tombolnya (gaya "The Prompt: AI Chat").
 */
export const PromptScreen: React.FC<P> = ({ item, durFrames, accent }) => {
  const { frame, enter, out } = useAnim(durFrames);
  const text = item.text;
  const typeEnd = Math.max(14, Math.round(durFrames * 0.58));
  const typed = Math.floor(interpolate(frame, [8, typeEnd], [0, text.length], clamp));
  const caret = frame < typeEnd + 4 && Math.floor(frame / 8) % 2 === 0;
  // dorongan kamera ke tombol kirim, lalu klik
  const pushStart = typeEnd + 2;
  const pushEnd = Math.max(pushStart + 6, Math.min(durFrames - 10, pushStart + 14));
  const push = interpolate(frame, [pushStart, pushEnd], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const clickAt = pushEnd - 2;
  const press = interpolate(frame, [clickAt, clickAt + 3, clickAt + 7], [1, 0.8, 1], clamp);
  const ripple = interpolate(frame, [clickAt + 2, clickAt + 14], [0, 1], clamp);
  const clicked = frame >= clickAt + 2;
  const cursorT = interpolate(frame, [pushStart, clickAt], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const badgePop = interpolate(frame, [4, 14], [0, 1], clamp);
  // tombol kirim digeser ke tengah layar sambil diperbesar
  const camera = `translate(${(540 - SEND_BTN.x) * push}px, ${(900 - SEND_BTN.y) * push}px) scale(${interpolate(enter, [0, 1], [1.06, 1]) * (1 + push * 0.9)})`;
  const chips = ["Buat gambar", "Tulis", "Cari tahu"];
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <SoftBg frame={frame} />
      <AbsoluteFill style={{ transform: camera, transformOrigin: `${SEND_BTN.x}px ${SEND_BTN.y}px` }}>
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
            height: 460,
            boxSizing: "border-box",
            padding: "44px 44px 120px",
            borderRadius: 48,
            background: "rgba(255,255,255,.72)",
            border: "2px solid rgba(255,255,255,.95)",
            boxShadow: "0 30px 80px rgba(80,60,160,.20), inset 0 2px 0 #fff",
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
          <div style={{ fontFamily: montserrat, fontWeight: 600, fontSize: text.length > 120 ? 32 : 40, lineHeight: 1.3, color: "#2b2b33" }}>
            {text.slice(0, typed)}
            <span style={{ opacity: caret ? 1 : 0, color: "#2b2b33" }}>|</span>
          </div>
          <div style={{ position: "absolute", left: 40, right: 40, bottom: 30, display: "flex", alignItems: "center", gap: 14 }}>
            {chips.map((c) => (
              <div key={c} style={{ fontFamily: montserrat, fontWeight: 600, fontSize: 26, color: "#6b6b76", padding: "10px 22px", borderRadius: 30, border: "2px solid rgba(0,0,0,.08)", background: "rgba(255,255,255,.6)" }}>
                {c}
              </div>
            ))}
            <div style={{ marginLeft: "auto", position: "relative", width: 72, height: 72 }}>
              {/* gelombang klik */}
              <div style={{ position: "absolute", left: 36 - (36 + 110 * ripple), top: 36 - (36 + 110 * ripple), width: (36 + 110 * ripple) * 2, height: (36 + 110 * ripple) * 2, borderRadius: "50%", border: `6px solid ${accent}`, opacity: ripple > 0 ? 1 - ripple : 0 }} />
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: clicked ? accent : "#111", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${press})`, boxShadow: "0 8px 20px rgba(0,0,0,.25)" }}>
                <svg width="34" height="34" viewBox="0 0 24 24">
                  <path d="M12 19V6M6 11l6-6 6 6" fill="none" stroke={clicked ? "#111" : "#fff"} strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        {/* kursor meluncur ke tombol kirim lalu menekan */}
        {frame >= pushStart ? (
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            style={{
              position: "absolute",
              left: interpolate(cursorT, [0, 1], [1060, SEND_BTN.x + 4]),
              top: interpolate(cursorT, [0, 1], [1420, SEND_BTN.y + 6]),
              transform: `scale(${press})`,
              transformOrigin: "0 0",
              filter: "drop-shadow(0 6px 10px rgba(0,0,0,.35))",
            }}
          >
            <path d="M3 2l17 9.5-7.200 1.600L9.500 20z" fill="#fff" stroke="#111" strokeWidth="1.600" strokeLinejoin="round" />
          </svg>
        ) : null}
      </AbsoluteFill>
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

/**
 * Banner notifikasi generik (kaca terang) yang turun dari atas di atas video pembicara,
 * lalu kamera mendorong pelan (gaya "New Message Notification"). Bukan logo/merek aplikasi tertentu.
 */
export const NotifBanner: React.FC<P> = ({ item, durFrames }) => {
  const { frame, fps } = useAnim(durFrames);
  const drop = spring({ frame, fps, config: { damping: 14, stiffness: 170 }, durationInFrames: 20 });
  const y = interpolate(drop, [0, 1], [-360, 0]) + interpolate(frame, [durFrames - 9, durFrames], [0, -360], clamp);
  const push = interpolate(frame, [18, Math.max(19, durFrames - 9)], [1, 1.06], clamp);
  const icon: AppIconName = item.icons?.[0] ?? "chat";
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 150, left: 50, width: 980, transform: `translateY(${y}px) scale(${push})`, transformOrigin: "50% 0%" }}>
        <div
          style={{
            background: "rgba(246,246,250,.94)",
            borderRadius: 46,
            padding: "26px 34px 32px",
            boxShadow: "0 24px 60px rgba(0,0,0,.38)",
            border: "1px solid rgba(255,255,255,.8)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <AppIcon name={icon} size={54} />
            <div style={{ flex: 1, fontFamily: montserrat, fontWeight: 600, fontSize: 28, letterSpacing: 1, color: "#6b6b76", textTransform: "uppercase" }}>
              {item.sub ?? "Berita"}
            </div>
            <div style={{ fontFamily: montserrat, fontWeight: 500, fontSize: 26, color: "#8a8a94" }}>sekarang</div>
          </div>
          <div style={{ marginTop: 16, fontFamily: montserrat, fontWeight: 800, fontSize: item.text.length > 70 ? 40 : 46, lineHeight: 1.2, color: "#111" }}>
            {item.text}
          </div>
        </div>
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
