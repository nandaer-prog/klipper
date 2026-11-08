import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { abril, archivo, elite, playfair } from "./collageFonts";
import { anton } from "./fonts";
import { RisoDeco } from "./Riso";
import { PAPER_NOISE, clamp, jitter, onTwos } from "./stopMotion";
import type { BRollItem } from "./types";

type Paper = { bg: string; ink: string; font: string; stripes?: boolean };

/** Potongan kertas: koran, kraft/kardus, hitam, majalah merah/kuning/biru, abu-abu. */
const PAPERS: Paper[] = [
  { bg: "#efe9d8", ink: "#161616", font: playfair },
  { bg: "#c69c6d", ink: "#24160b", font: abril, stripes: true },
  { bg: "#161616", ink: "#f3efe4", font: archivo },
  { bg: "#e8392e", ink: "#ffffff", font: anton },
  { bg: "#ffd43b", ink: "#141414", font: archivo },
  { bg: "#a9b4c2", ink: "#141414", font: elite },
  { bg: "#2f6fe4", ink: "#ffffff", font: playfair },
  { bg: "#f6f3ea", ink: "#c0262d", font: abril },
];

/** Tepi guntingan yang tidak rata (clip-path poligon 8 titik). */
const roughClip = (seed: string) => {
  const j = (k: number) => random(`${seed}-e${k}`) * 5;
  const p = (x: number, y: number) => `${x.toFixed(1)}% ${y.toFixed(1)}%`;
  return `polygon(${[
    p(j(0), j(1)),
    p(50, j(2)),
    p(100 - j(3), j(4)),
    p(100 - j(5), 50),
    p(100 - j(6), 100 - j(7)),
    p(50, 100 - j(8)),
    p(j(9), 100 - j(10)),
    p(j(11), 50),
  ].join(", ")})`;
};

const paperIndex = (seed: string, idx: number) => Math.floor(random(`${seed}-${idx}-p`) * PAPERS.length);

const Letter: React.FC<{ ch: string; idx: number; seed: string; fontSize: number; frame: number }> = ({ ch, idx, seed, fontSize, frame }) => {
  const s = `${seed}-${idx}`;
  let p = paperIndex(seed, idx);
  // huruf bersebelahan jangan dari kertas yang sama
  if (idx > 0 && p === paperIndex(seed, idx - 1)) p = (p + 3) % PAPERS.length;
  const paper = PAPERS[p]!;
  // mendarat satu per satu "on twos", lalu bergetar halus "on threes"
  const q = onTwos(frame) - idx * 2;
  const land = q < 0 ? 0 : q === 0 ? 1.35 : q === 2 ? 0.94 : 1;
  const kick = q === 0 ? (random(`${s}-d`) > 0.5 ? 12 : -12) : 0;
  const settled = q >= 4;
  const rot = (random(`${s}-r`) - 0.5) * 16 + kick + (settled ? jitter(`${s}-j`, frame) * 1.5 : 0);
  const y = (random(`${s}-y`) - 0.5) * 22 + (settled ? jitter(`${s}-k`, frame) * 2 : 0);
  const size = fontSize * (0.92 + random(`${s}-s`) * 0.22);
  const padX = 10 + random(`${s}-px`) * 10;
  return (
    <div style={{ opacity: q < 0 ? 0 : 1, margin: "0 3px", transform: `translateY(${y}px) rotate(${rot}deg) scale(${land})`, filter: "drop-shadow(0 6px 5px rgba(0,0,0,.45))" }}>
      <div
        style={{
          fontFamily: paper.font,
          fontSize: size,
          lineHeight: 1,
          color: paper.ink,
          backgroundColor: paper.bg,
          backgroundImage: paper.stripes ? `${PAPER_NOISE}, repeating-linear-gradient(90deg, rgba(0,0,0,.08) 0 3px, transparent 3px 9px)` : PAPER_NOISE,
          padding: `${8 + random(`${s}-pt`) * 8}px ${padX}px ${5 + random(`${s}-pb`) * 6}px`,
          clipPath: roughClip(s),
          textAlign: "center",
          minWidth: size * 0.55,
        }}
      >
        {ch}
      </div>
    </div>
  );
};

/** Keyword gaya surat kaleng: tiap huruf potongan kertas berbeda yang ditempel satu per satu. */
export const RansomWord: React.FC<{ item: BRollItem; durFrames: number }> = ({ item, durFrames }) => {
  const frame = useCurrentFrame();
  const words = item.text.toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[][] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && [...last, w].join(" ").length <= 9) last.push(w);
    else lines.push([w]);
  }
  const longest = Math.max(...lines.map((l) => l.join(" ").length));
  const fontSize = longest <= 6 ? 112 : longest <= 8 ? 96 : longest <= 10 ? 84 : 70;
  const out = interpolate(frame, [durFrames - 8, durFrames], [1, 0], clamp);
  const letterCount = words.join("").length;
  const subShown = onTwos(frame) >= letterCount * 2 + 4;
  // lebih tinggi dari caption (yang mulai di y=1190), termasuk baris sub-teks di bawah huruf
  const top = Math.round(870 - lines.length * fontSize * 0.75);
  const blockH = lines.length * fontSize * 1.45;
  let k = 0;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <RisoDeco
        seed={`${item.text}-ransom`}
        spots={[
          { x: 150, y: top - 30, size: 190, delay: 2 },
          { x: 935, y: top + blockH + 30, size: 170, delay: 6 },
        ]}
      />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: top }}>
        {lines.map((line, li) => (
          <div key={li} style={{ display: "flex", alignItems: "center", marginTop: li ? 18 : 0 }}>
            {line.map((word, wi) => (
              <div key={wi} style={{ display: "flex", marginRight: wi < line.length - 1 ? 34 : 0 }}>
                {[...word].map((ch) => {
                  const idx = k++;
                  return <Letter key={idx} ch={ch} idx={idx} seed={item.text} fontSize={fontSize} frame={frame} />;
                })}
              </div>
            ))}
          </div>
        ))}
        {item.sub && subShown ? (
          <div
            style={{
              marginTop: 26,
              fontFamily: elite,
              fontSize: 38,
              color: "#161616",
              backgroundColor: "#f6f3ea",
              backgroundImage: PAPER_NOISE,
              padding: "8px 18px",
              textTransform: "uppercase",
              transform: `rotate(${-1.5 + jitter(`${item.text}-sub`, frame)}deg)`,
              boxShadow: "0 6px 10px rgba(0,0,0,.35)",
            }}
          >
            {item.sub}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
