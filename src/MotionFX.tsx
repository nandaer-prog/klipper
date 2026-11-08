import type { Caption } from "@remotion/captions";
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MoneyMascot, PeekingBuddy } from "./Characters";
import { CollageDefs, CollageSticker, GlitchEyes } from "./Collage";
import { LightLeak, Viewfinder } from "./Overlays";
import { TONE_STYLE, type Tone } from "./tone";
import type { BRollItem, IconName } from "./types";
import { emphasisBeats, iconForWord, normWord, toWords, wordClass } from "./wordIcons";

/**
 * icon = stiker kolase, eyes = mata glitch, peek = karakter mengintip, money = maskot uang,
 * rec = bingkai jendela bidik kamera (REC) selayar penuh.
 */
export type StickerKind = "icon" | "eyes" | "peek" | "money" | "rec";
type Sticker = { at: number; dur: number; kind: StickerKind; icon: IconName; side: "left" | "right" };

/** Lama tampil tiap jenis (detik). */
const DUR: Record<StickerKind, number> = { icon: 1.3, eyes: 1.8, peek: 2, money: 2.2, rec: 2.2 };

/**
 * Stiker pada kata penting (emphasis), kata bermakna kuat (presiden, bahaya...), kata pengawasan,
 * dan kata uang. Dilewati saat hook tampil atau saat B-roll aktif, dan diberi jeda setelah stiker sebelumnya.
 */
export const buildStickers = (
  captions: Caption[],
  emphasis: string[],
  broll: BRollItem[],
  opts: { skipBefore: number; gap?: number; tone?: Tone },
): Sticker[] => {
  const gap = opts.gap ?? 1.5;
  // kata pengawasan/uang bergiliran di dalam paket stiker sesuai nada klip
  const SURVEIL_CYCLE = TONE_STYLE[opts.tone ?? "edukasi"].surveil;
  const MONEY_CYCLE = TONE_STYLE[opts.tone ?? "edukasi"].money;
  const emphAt = new Set(emphasisBeats(captions, emphasis));
  const busy = (t0: number, t1: number) => broll.some((b) => t1 >= b.at - 0.4 && t0 <= b.at + b.dur + 0.4);
  const out: Sticker[] = [];
  let surveil = 0;
  let money = 0;
  for (const w of toWords(captions)) {
    const t = w.startMs / 1000;
    const cls = wordClass(w.text);
    const matched = iconForWord(w.text);
    const strong = !!matched && normWord(w.text).length >= 5;
    if ((!emphAt.has(t) && !cls && !strong) || t < opts.skipBefore) continue;
    const kind: StickerKind = cls === "surveil" ? SURVEIL_CYCLE[surveil % SURVEIL_CYCLE.length]! : cls === "money" ? MONEY_CYCLE[money % MONEY_CYCLE.length]! : "icon";
    const dur = DUR[kind];
    const prev = out[out.length - 1];
    if ((prev && t < prev.at + prev.dur + gap) || busy(t, t + dur)) continue;
    if (cls === "surveil") surveil++;
    if (cls === "money") money++;
    out.push({ at: t, dur, kind, icon: matched ?? "star", side: out.length % 2 === 0 ? "right" : "left" });
  }
  return out;
};

const StickerView: React.FC<{ s: Sticker; accent: string; durFrames: number }> = ({ s, accent, durFrames }) => {
  const seed = `st-${s.at}`;
  if (s.kind === "rec") return <Viewfinder durFrames={durFrames} startSec={s.at} seed={seed} />;
  if (s.kind === "peek") {
    // dari tepi bawah layar, di bawah area caption
    return (
      <div style={{ position: "absolute", left: s.side === "right" ? 640 : 100, top: 1620 }}>
        <PeekingBuddy durFrames={durFrames} />
      </div>
    );
  }
  if (s.kind === "eyes") {
    return (
      <div style={{ position: "absolute", left: 200, top: 900 }}>
        <GlitchEyes seed={seed} durFrames={durFrames} />
      </div>
    );
  }
  if (s.kind === "money") {
    return (
      <div style={{ position: "absolute", top: 760, [s.side]: 20, transform: "scale(1.35)", transformOrigin: s.side === "left" ? "0 100%" : "100% 100%" }}>
        <MoneyMascot side={s.side} durFrames={durFrames} />
      </div>
    );
  }
  // setinggi dada, tepat di atas caption: hampir tidak pernah menutupi wajah
  return (
    <div style={{ position: "absolute", top: 930, [s.side]: 40 }}>
      <CollageSticker icon={s.icon} accent={accent} seed={seed} durFrames={durFrames} />
    </div>
  );
};

/** Kilatan putih + garis kecepatan sesaat ketika B-roll masuk, agar pergantian terasa menghentak. */
const EntryFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [0, 1, 5], [0, 0.55, 0], { extrapolateRight: "clamp" });
  const lines = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
      <svg width={1080} height={1920} style={{ position: "absolute", opacity: 1 - lines }}>
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          const r0 = 500 + lines * 600;
          return (
            <line
              key={i}
              x1={540 + Math.cos(a) * r0}
              y1={960 + Math.sin(a) * r0}
              x2={540 + Math.cos(a) * (r0 + 420)}
              y2={960 + Math.sin(a) * (r0 + 420)}
              stroke="#fff"
              strokeWidth={8}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** B-roll layar penuh: masuk dengan bocoran cahaya, bukan kilatan putih. */
const FULLSCREEN = new Set<BRollItem["type"]>(["scene", "prompt", "orbit"]);

/** Lapisan motion graphic otomatis: stiker/karakter/overlay pada kata tertentu + transisi saat B-roll masuk. */
export const MotionFX: React.FC<{
  captions: Caption[];
  emphasis: string[];
  broll: BRollItem[];
  accent: string;
  hook: boolean;
  tone?: Tone;
}> = ({ captions, emphasis, broll, accent, hook, tone }) => {
  const { fps } = useVideoConfig();
  const stickers = buildStickers(captions, emphasis, broll, { skipBefore: hook ? 3.4 : 0.5, tone });
  return (
    <>
      <CollageDefs />
      {stickers.map((s) => {
        const durFrames = Math.round(s.dur * fps);
        return (
          <Sequence key={`st-${s.at}`} from={Math.round(s.at * fps)} durationInFrames={durFrames} layout="none">
            <StickerView s={s} accent={accent} durFrames={durFrames} />
          </Sequence>
        );
      })}
      {broll.map((b, i) =>
        FULLSCREEN.has(b.type) ? (
          <Sequence key={`fl-${b.at}-${i}`} from={Math.round(b.at * fps)} durationInFrames={16} layout="none">
            <LightLeak durFrames={16} seed={`ll-${b.at}`} />
          </Sequence>
        ) : (
          <Sequence key={`fl-${b.at}-${i}`} from={Math.round(b.at * fps)} durationInFrames={10} layout="none">
            <EntryFlash />
          </Sequence>
        ),
      )}
    </>
  );
};
