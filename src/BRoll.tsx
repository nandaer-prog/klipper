import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { anton, montserrat } from "./fonts";
import { NewsCard, OrbitScreen, PromptScreen } from "./BRollScreens";
import { Icon } from "./Icons";
import type { BRollItem } from "./types";

const useAnim = (durFrames: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 190 }, durationInFrames: 16 });
  const out = interpolate(frame, [durFrames - 8, durFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { frame, enter, out };
};

const IconCard: React.FC<{ item: BRollItem; durFrames: number; accent: string; index: number }> = ({
  item,
  durFrames,
  accent,
  index,
}) => {
  const { frame, enter, out } = useAnim(durFrames);
  const right = index % 2 === 0;
  const slide = interpolate(enter, [0, 1], [right ? 420 : -420, 0]);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 330,
          [right ? "right" : "left"]: 44,
          opacity: out,
          transform: `translateX(${slide}px) rotate(${(right ? 1 : -1) * 4}deg)`,
          width: 330,
          padding: "28px 20px 24px",
          borderRadius: 38,
          background: "rgba(12,12,34,.78)",
          border: `5px solid ${accent}`,
          boxShadow: "0 18px 40px rgba(0,0,0,.45)",
          textAlign: "center",
        }}
      >
        <div style={{ transform: `rotate(${Math.sin(frame / 5) * 7}deg) scale(${1 + Math.sin(frame / 7) * 0.05})` }}>
          <Icon name={item.icon ?? "star"} size={190} color={accent} />
        </div>
        <div style={{ fontFamily: montserrat, fontWeight: 900, fontSize: 40, color: "#fff", textTransform: "uppercase", marginTop: 10, lineHeight: 1.1 }}>
          {item.text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ item: BRollItem; durFrames: number; accent: string }> = ({ item, durFrames, accent }) => {
  const { enter, out } = useAnim(durFrames);
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 800, opacity: out }}>
      <div style={{ transform: `scale(${interpolate(enter, [0, 1], [0.4, 1])})`, textAlign: "center" }}>
        <div
          style={{
            fontFamily: anton,
            fontSize: item.text.length > 8 ? 150 : 210,
            lineHeight: 1,
            background: `linear-gradient(180deg, #fff 10%, ${accent} 90%)`,
            WebkitBackgroundClip: "text",
            color: "transparent",
            WebkitTextStroke: "3px #111",
            filter: "drop-shadow(0 10px 0 #111) drop-shadow(0 18px 24px rgba(0,0,0,.5))",
          }}
        >
          {item.text}
        </div>
        {item.sub ? (
          <div style={{ fontFamily: montserrat, fontWeight: 900, fontSize: 44, color: "#fff", textTransform: "uppercase", marginTop: 8, textShadow: "0 4px 14px rgba(0,0,0,.8)" }}>
            {item.sub}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const Keyword: React.FC<{ item: BRollItem; durFrames: number; accent: string }> = ({ item, durFrames, accent }) => {
  const { enter, out } = useAnim(durFrames);
  const x = interpolate(enter, [0, 1], [-1100, 0]);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", top: 860, left: 0, transform: `translateX(${x}px)` }}>
        <div
          style={{
            background: accent,
            color: "#111",
            fontFamily: anton,
            fontSize: 104,
            textTransform: "uppercase",
            padding: "14px 60px 18px 48px",
            borderRadius: "0 28px 28px 0",
            border: "5px solid #111",
            borderLeft: "none",
            boxShadow: "0 10px 0 #111",
            lineHeight: 1.05,
          }}
        >
          {item.text}
        </div>
        {item.sub ? (
          <div style={{ fontFamily: montserrat, fontWeight: 900, fontSize: 40, color: "#fff", marginTop: 16, marginLeft: 48, textTransform: "uppercase", textShadow: "0 4px 14px rgba(0,0,0,.85)" }}>
            {item.sub}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** Cutaway layar penuh: latar animasi + ikon besar + headline (suara pembicara tetap berjalan). */
const Scene: React.FC<{ item: BRollItem; durFrames: number; accent: string }> = ({ item, durFrames, accent }) => {
  const { frame, enter, out } = useAnim(durFrames);
  const inOpacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const blobs = [0, 1, 2, 3, 4, 5];
  if (item.footage) {
    // footage nyata (Pixabay) layar penuh, tanpa suara; headline di bawah
    return (
      <AbsoluteFill style={{ opacity: Math.min(out, inOpacity), transform: `scale(${interpolate(enter, [0, 1], [1.08, 1])})` }}>
        <OffthreadVideo src={staticFile(item.footage)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.05) 45%, rgba(0,0,0,.35) 100%)" }} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 330 }}>
          <div
            style={{
              fontFamily: anton,
              fontSize: item.text.length > 18 ? 110 : 140,
              lineHeight: 1.04,
              textTransform: "uppercase",
              textAlign: "center",
              color: "#fff",
              maxWidth: 900,
              WebkitTextStroke: "10px #111",
              paintOrder: "stroke fill",
              textShadow: "0 10px 0 rgba(0,0,0,.35)",
            }}
          >
            {item.text}
          </div>
          {item.sub ? (
            <div style={{ fontFamily: montserrat, fontWeight: 900, fontSize: 46, color: accent, marginTop: 18, textTransform: "uppercase", textShadow: "0 4px 14px rgba(0,0,0,.7)" }}>
              {item.sub}
            </div>
          ) : null}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ opacity: Math.min(out, inOpacity), transform: `scale(${interpolate(enter, [0, 1], [1.12, 1])})` }}>
      <AbsoluteFill style={{ background: `linear-gradient(${150 + frame * 0.8}deg, #1d0f4f 0%, #6a2cff 45%, ${accent} 130%)` }} />
      {blobs.map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 120 + ((i * 197) % 800) + Math.sin(frame / 22 + i) * 70,
            top: 160 + ((i * 331) % 1500) + Math.cos(frame / 26 + i * 2) * 80,
            width: 150 + (i % 3) * 110,
            height: 150 + (i % 3) * 110,
            borderRadius: "50%",
            background: i % 2 ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.18)",
          }}
        />
      ))}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 300 }}>
        <div style={{ transform: `rotate(${Math.sin(frame / 9) * 6}deg) scale(${1 + Math.sin(frame / 8) * 0.04})` }}>
          <Icon name={item.icon ?? "bolt"} size={380} color={accent} />
        </div>
        <div
          style={{
            marginTop: 36,
            fontFamily: anton,
            fontSize: item.text.length > 18 ? 118 : 150,
            lineHeight: 1.04,
            textTransform: "uppercase",
            textAlign: "center",
            color: "#fff",
            maxWidth: 900,
            WebkitTextStroke: "10px #111",
            paintOrder: "stroke fill",
            textShadow: "0 10px 0 rgba(0,0,0,.35)",
          }}
        >
          {item.text}
        </div>
        {item.sub ? (
          <div style={{ fontFamily: montserrat, fontWeight: 900, fontSize: 46, color: accent, marginTop: 18, textTransform: "uppercase", textShadow: "0 4px 14px rgba(0,0,0,.7)" }}>
            {item.sub}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const BRollLayer: React.FC<{ items: BRollItem[]; accent: string }> = ({ items, accent }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {items.map((item, i) => {
        const from = Math.round(item.at * fps);
        const durFrames = Math.max(12, Math.round(item.dur * fps));
        return (
          <Sequence key={`${item.at}-${i}`} from={from} durationInFrames={durFrames} layout="none">
            {item.type === "scene" ? (
              <Scene item={item} durFrames={durFrames} accent={accent} />
            ) : item.type === "prompt" ? (
              <PromptScreen item={item} durFrames={durFrames} accent={accent} />
            ) : item.type === "card" ? (
              <NewsCard item={item} durFrames={durFrames} accent={accent} />
            ) : item.type === "orbit" ? (
              <OrbitScreen item={item} durFrames={durFrames} accent={accent} />
            ) : item.type === "stat" ? (
              <Stat item={item} durFrames={durFrames} accent={accent} />
            ) : item.type === "keyword" ? (
              <Keyword item={item} durFrames={durFrames} accent={accent} />
            ) : (
              <IconCard item={item} durFrames={durFrames} accent={accent} index={i} />
            )}
          </Sequence>
        );
      })}
    </>
  );
};
