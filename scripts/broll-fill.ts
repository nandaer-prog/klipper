import type { Caption } from "@remotion/captions";
import type { BRollItem } from "../src/types";
import { iconForWord, normWord as norm, toWords } from "../src/wordIcons";

/** Satuan setelah angka yang layak dijadikan B-roll stat. */
const UNITS: Record<string, string> = {
  persen: "%",
  juta: " JUTA",
  miliar: " MILIAR",
  milyar: " MILIAR",
  triliun: " TRILIUN",
  ribu: " RIBU",
  tahun: " TAHUN",
  bulan: " BULAN",
  hari: " HARI",
  jam: " JAM",
  menit: " MENIT",
  kali: "X",
  orang: " ORANG",
};

type Candidate = BRollItem & { prio: number };

const clean = (s: string) => s.replace(/[^\p{L}\p{N}\s-]+/gu, "").trim().toUpperCase();

/**
 * Kandidat isian, urut prioritas:
 * 0 = angka + satuan dari transkrip (stat), 1 = kata/frasa penting (keyword),
 * 2 = kata bermakna kuat seperti presiden/korupsi/bahaya (kartu ikon).
 */
const candidates = (captions: Caption[], emphasis: string[]): Candidate[] => {
  const out: Candidate[] = [];
  const words = toWords(captions);
  const normed = words.map((w) => norm(w.text));
  const atOf = (i: number) => words[i]!.startMs / 1000;
  // teks yang sama boleh muncul lagi setelah 20 detik
  const lastUse = new Map<string, number>();
  const fresh = (key: string, at: number) => {
    if (at - (lastUse.get(key) ?? -99) < 20) return false;
    lastUse.set(key, at);
    return true;
  };

  words.forEach((w, i) => {
    const num = w.text.replace(/[^\d.,%]/g, "").replace(/[.,]+$/, "");
    if (!/^\d[\d.,]*%?$/.test(num)) return;
    // "2-3-2 menit" jadi "232" setelah strip dibuang: angka dari beberapa token satu digit tidak bisa dipercaya
    if (w.tokens.filter((t) => /^\d$/.test(t)).length >= 2) return;
    const unit = num.endsWith("%") ? "" : UNITS[normed[i + 1] ?? ""];
    if (unit === undefined) return;
    const prev = normed[i - 1] ?? "";
    const prefix = prev === "rp" || prev === "rupiah" || /^rp/i.test(w.text) ? "Rp" : "";
    const text = prefix + num + unit;
    if (fresh(text, atOf(i))) out.push({ at: atOf(i), dur: 2, type: "stat", text, prio: 0 });
  });

  // frasa ("jeff bezos") dicocokkan ke kata berurutan
  for (const phrase of emphasis) {
    const toks = phrase.split(/\s+/).map(norm).filter(Boolean);
    if (!toks.length || toks.join("").length < 3) continue;
    normed.forEach((_, i) => {
      if (!toks.every((t, k) => normed[i + k] === t) || !fresh(toks.join(" "), atOf(i))) return;
      out.push({ at: atOf(i), dur: 1.6, type: "keyword", text: clean(phrase), prio: 1 });
    });
  }

  // cadangan sekali per kata dasar per klip ("kecewa"/"kekecewaan" tidak diulang); kata kepanjangan = salah tangkap Whisper
  const usedStem = new Set<string>();
  normed.forEach((n, i) => {
    const icon = iconForWord(n);
    const stem = n.replace(/^(ke|pe|me|di)/, "").slice(0, 5);
    if (!icon || n.length < 5 || n.length > 13 || usedStem.has(stem)) return;
    usedStem.add(stem);
    out.push({ at: atOf(i), dur: 1.8, type: "icon", icon, text: clean(words[i]!.text), prio: 2 });
  });
  return out.sort((a, b) => a.prio - b.prio || a.at - b.at);
};

/**
 * Isi jeda panjang tanpa B-roll dengan stat/keyword/kartu ikon otomatis supaya klip lebih ramai.
 * Item dari pemilih momen tidak diubah; item tambahan dijaga minimal `gap` detik dari item lain.
 * Matikan dengan BROLL_FILL=0.
 */
export const fillBrollGaps = (
  items: BRollItem[],
  captions: Caption[],
  emphasis: string[],
  clipDur: number,
  opts: { skipBefore: number; gap?: number; maxAdd?: number },
): BRollItem[] => {
  if (process.env.BROLL_FILL === "0") return items;
  const gap = opts.gap ?? 2.2;
  const maxAdd = opts.maxAdd ?? Math.ceil(clipDur / 9);
  const all = [...items];
  let added = 0;
  for (const cand of candidates(captions, emphasis)) {
    if (added >= maxAdd) break;
    const c: BRollItem = { at: cand.at, dur: cand.dur, type: cand.type, text: cand.text, ...(cand.icon ? { icon: cand.icon } : {}) };
    if (c.at < opts.skipBefore || c.at + c.dur > clipDur - 0.5) continue;
    const clear = all.every((e) => c.at >= e.at + e.dur + gap || c.at + c.dur + gap <= e.at);
    if (!clear) continue;
    all.push(c);
    added++;
  }
  return all.sort((a, b) => a.at - b.at);
};
