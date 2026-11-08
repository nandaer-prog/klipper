import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { anton, montserrat } from "./fonts";
import { NewsCard, NotifBanner, OrbitScreen, PromptScreen } from "./BRollScreens";
import { KeywordFX } from "./KeywordFX";
import { NeonTunnel, RisoPaper, SynthGrid } from "./Backgrounds";
import { ArrowDoodle } from "./Doodles";
import { RansomWord } from "./Ransom";
import { TONE_STYLE, type Tone } from "./tone";
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

/**
 * Pecah teks stat menjadi awalan, angka, dan akhiran, misal "Rp50,5 T" atau "1.000.000".
 * Format Indonesia: titik = pemisah ribuan, koma = desimal. Null kalau tidak ada angka.
 */
export const parseStat = (text: string) => {
  const m = text.match(/^(\D*?)(\d[\d.,]*\d|\d)(.*)$/);
  if (!m) return null;
  const [, prefix, raw, suffix] = m as unknown as [string, string, string, string];
  let decSep = ",";
  let groupSep = ".";
  if (!raw.includes(",") && raw.includes(".") && !/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    // satu titik bukan pola ribuan, misal "2.5" = desimal gaya Inggris
    decSep = ".";
    groupSep = ",";
  }
  const [intPart, decPart = ""] = raw.split(decSep);
  const value = Number(`${intPart!.split(groupSep).join("")}.${decPart || "0"}`);
  if (!Number.isFinite(value)) return null;
  return { prefix, suffix, value, decimals: decPart.length, grouped: intPart!.includes(groupSep), decSep, groupSep };
};

const formatStat = (v: number, p: NonNullable<ReturnType<typeof parseStat>>) => {
  const [i, d] = v.toFixed(p.decimals).split(".");
  const int = p.grouped ? i!.replace(/\B(?=(\d{3})+(?!\d))/g, p.groupSep) : i!;
  return p.prefix + int + (d ? p.decSep + d : "") + p.suffix;
};

const statNumberStyle = (fontSize: number, accent: string): React.CSSProperties => ({
  fontFamily: anton,
  fontSize,
  lineHeight: 1,
  background: `linear-gradient(180deg, #fff 10%, ${accent} 90%)`,
  WebkitBackgroundClip: "text",
  color: "transparent",
  WebkitTextStroke: "3px #111",
  filter: "drop-shadow(0 10px 0 #111) drop-shadow(0 18px 24px rgba(0,0,0,.5))",
  fontVariantNumeric: "tabular-nums",
});

const RING_R = 255;
const RING_C = 2 * Math.PI * RING_R;

const Stat: React.FC<{ item: BRollItem; durFrames: number; accent: string }> = ({ item, durFrames, accent }) => {
  const { frame, enter, out } = useAnim(durFrames);
  const { fps } = useVideoConfig();
  const parsed = parseStat(item.text);
  // angka naik dari 0 ke nilai akhir dalam ~0,8 detik (ease-out), lalu sedikit "denyut" saat sampai
  const countEnd = Math.min(Math.round(fps * 0.8), Math.max(4, durFrames - 12));
  const t = interpolate(frame, [2, countEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const eased = 1 - Math.pow(1 - t, 3);
  const shown = parsed ? formatStat(parsed.value * eased, parsed) : item.text;
  const landPop = parsed ? interpolate(frame, [countEnd, countEnd + 4, countEnd + 9], [1, 1.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const scale = interpolate(enter, [0, 1], [0.4, 1]) * landPop;

  // persen: cincin progres ikut terisi bersama angka (gaya "Counter: Progress Ring")
  const pct = parsed && parsed.suffix.trim().startsWith("%") ? Math.min(1, Math.max(0, parsed.value / 100)) : null;
  if (pct !== null) {
    const filled = pct * eased;
    return (
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 640, opacity: out }}>
        <div style={{ position: "relative", width: 520, height: 520, transform: `scale(${scale})` }}>
          <div style={{ position: "absolute", inset: 34, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,0,0,.6) 0%, rgba(0,0,0,.35) 65%, rgba(0,0,0,0) 100%)" }} />
          <svg width={520} height={520} viewBox="0 0 600 600" style={{ position: "absolute", left: 0, top: 0, transform: "rotate(-90deg)", filter: "drop-shadow(0 8px 16px rgba(0,0,0,.45))" }}>
            <circle cx={300} cy={300} r={RING_R} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={34} />
            <circle
              cx={300}
              cy={300}
              r={RING_R}
              fill="none"
              stroke={accent}
              strokeWidth={34}
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - filled)}
              opacity={filled > 0.005 ? 1 : 0}
            />
          </svg>
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <div style={statNumberStyle(item.text.length > 5 ? 130 : 165, accent)}>{shown}</div>
            {item.sub ? (
              <div style={{ fontFamily: montserrat, fontWeight: 900, fontSize: 32, color: "#fff", textTransform: "uppercase", marginTop: 6, maxWidth: 360, textAlign: "center", lineHeight: 1.1, textShadow: "0 4px 14px rgba(0,0,0,.8)" }}>
                {item.sub}
              </div>
            ) : null}
          </AbsoluteFill>
        </div>
        <StatArrows seed={item.text} halfWidth={262} y={905} />
      </AbsoluteFill>
    );
  }

  const fontSize = item.text.length > 8 ? 150 : 210;
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 800, opacity: out }}>
      <div style={{ transform: `scale(${scale})`, textAlign: "center" }}>
        <div style={statNumberStyle(fontSize, accent)}>{shown}</div>
        {item.sub ? (
          <div style={{ fontFamily: montserrat, fontWeight: 900, fontSize: 44, color: "#fff", textTransform: "uppercase", marginTop: 8, textShadow: "0 4px 14px rgba(0,0,0,.8)" }}>
            {item.sub}
          </div>
        ) : null}
      </div>
      <StatArrows seed={item.text} halfWidth={(item.text.length * fontSize * 0.46) / 2} y={900} />
    </AbsoluteFill>
  );
};

/** Dua panah kartun dari kiri dan kanan yang menunjuk ke angka (gaya "cartoon dynamic arrows"). */
const StatArrows: React.FC<{ seed: string; halfWidth: number; y: number }> = ({ seed, halfWidth, y }) => {
  const gapX = Math.min(420, halfWidth + 26);
  const kinds = ["curve", "loop", "striped"] as const;
  const k = Math.floor(random(`${seed}-arrow`) * kinds.length);
  return (
    <>
      <ArrowDoodle kind={kinds[k]!} seed={`${seed}-a1`} x={Math.max(110, 540 - gapX)} y={y + 10} pointAt={8} delay={6} scale={0.85} />
      <ArrowDoodle kind={kinds[(k + 1) % kinds.length]!} seed={`${seed}-a2`} x={Math.min(970, 540 + gapX)} y={y + 10} pointAt={172} mirror delay={10} scale={0.85} />
    </>
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

/** Latar cutaway tanpa footage: gradasi lama, terowongan neon, grid synthwave, atau kertas risograph. */
export type SceneBg = "gradient" | "tunnel" | "grid" | "riso";

/** Cutaway layar penuh: latar animasi + ikon besar + headline (suara pembicara tetap berjalan). */
const Scene: React.FC<{ item: BRollItem; durFrames: number; accent: string; bg: SceneBg }> = ({ item, durFrames, accent, bg }) => {
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
      {bg === "tunnel" ? (
        <NeonTunnel frame={frame} />
      ) : bg === "grid" ? (
        <SynthGrid frame={frame} />
      ) : bg === "riso" ? (
        <RisoPaper seed={`scene-${item.text}`} />
      ) : (
        <>
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
        </>
      )}
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

export const BRollLayer: React.FC<{ items: BRollItem[]; accent: string; tone?: Tone }> = ({ items, accent, tone = "edukasi" }) => {
  const { fps } = useVideoConfig();
  // gaya keyword dan latar scene bergantian di dalam paket gaya sesuai nada klip
  const style = TONE_STYLE[tone];
  // nomor urut per tipe: keyword ke-n memakai gaya ke-n, kartu ganjil tampil sebagai notifikasi
  const seen: Partial<Record<BRollItem["type"], number>> = {};
  const nth = items.map((it) => {
    const n = seen[it.type] ?? 0;
    seen[it.type] = n + 1;
    return n;
  });
  return (
    <>
      {items.map((item, i) => {
        const from = Math.round(item.at * fps);
        const durFrames = Math.max(12, Math.round(item.dur * fps));
        const kwStyle = style.keyword[nth[i]! % style.keyword.length]!;
        return (
          <Sequence key={`${item.at}-${i}`} from={from} durationInFrames={durFrames} layout="none">
            {item.type === "scene" ? (
              <Scene item={item} durFrames={durFrames} accent={accent} bg={style.sceneBg[nth[i]! % style.sceneBg.length]!} />
            ) : item.type === "prompt" ? (
              <PromptScreen item={item} durFrames={durFrames} accent={accent} />
            ) : item.type === "card" ? (
              nth[i]! % 2 === 1 ? (
                <NotifBanner item={item} durFrames={durFrames} accent={accent} />
              ) : (
                <NewsCard item={item} durFrames={durFrames} accent={accent} />
              )
            ) : item.type === "orbit" ? (
              <OrbitScreen item={item} durFrames={durFrames} accent={accent} />
            ) : item.type === "stat" ? (
              <Stat item={item} durFrames={durFrames} accent={accent} />
            ) : item.type === "keyword" ? (
              kwStyle === "slide" ? (
                <Keyword item={item} durFrames={durFrames} accent={accent} />
              ) : kwStyle === "ransom" ? (
                <RansomWord item={item} durFrames={durFrames} papers={style.ransomPapers} />
              ) : (
                <KeywordFX item={item} durFrames={durFrames} accent={accent} variant={kwStyle} />
              )
            ) : (
              <IconCard item={item} durFrames={durFrames} accent={accent} index={i} />
            )}
          </Sequence>
        );
      })}
    </>
  );
};
