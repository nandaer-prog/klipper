import type { Caption } from "@remotion/captions";
import type { IconName } from "./types";

export const normWord = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export type Word = { text: string; startMs: number; endMs: number; tokens: string[] };

/**
 * Caption Whisper berupa potongan kata (" pen", "y", "ad", "apan"). Token yang diawali spasi
 * memulai kata baru; sisanya disambung ke kata sebelumnya -> "penyadapan".
 */
export const toWords = (captions: Caption[]): Word[] => {
  const out: Word[] = [];
  for (const c of captions) {
    const t = c.text.trim();
    if (!t) continue;
    const prev = out[out.length - 1];
    // kata baru juga dimulai setelah tanda baca ("rumah," + "santai"), kecuali angka seperti "1.000" atau "2,5"
    const afterPunct = !!prev && /[.,!?…;:]$/.test(prev.text) && !(/\d[.,]$/.test(prev.text) && /^\d/.test(t));
    if (prev && !/^\s/.test(c.text) && !afterPunct) {
      prev.text += t;
      prev.endMs = c.endMs;
      prev.tokens.push(t);
    } else {
      out.push({ text: t, startMs: c.startMs, endMs: c.endMs, tokens: [t] });
    }
  }
  return out;
};

/** Waktu (detik) kata penting; frasa ("jeff bezos") dicocokkan pada kata-kata berurutan. */
export const emphasisBeats = (captions: Caption[], emphasis: string[]) => {
  const words = toWords(captions);
  const normed = words.map((w) => normWord(w.text));
  const beats: number[] = [];
  for (const phrase of emphasis) {
    const toks = phrase.split(/\s+/).map(normWord).filter(Boolean);
    if (!toks.length) continue;
    normed.forEach((_, i) => {
      if (toks.every((t, k) => normed[i + k] === t)) beats.push(words[i]!.startMs / 1000);
    });
  }
  return beats.sort((a, b) => a - b);
};

/**
 * Awal kata -> ikon. Sengaja hanya kata yang bermakna kuat; kata yang sangat umum
 * ("bisa", "tahu", "sekarang") tidak dimasukkan agar stiker tidak muncul terus.
 */
const ICON_RULES: [RegExp, IconName][] = [
  [/^(uang|duit|rupiah|triliun|miliar|milyar|juta|bayar|gaji|harga|mahal|murah|untung|rugi|modal|cuan|dana|korupsi|anggaran|pajak|utang|hutang)/, "money"],
  [/^(bahaya|awas|hatihati|ancam|risiko|skandal|sadap|penyadap|bohong|tipu|curang|masalah|kudeta|krisis|blackout|bocor|retas|hack)/, "warning"],
  [/^(panas|viral|marah|parah|heboh|ngamuk|emosi|kecewa|kekecewa|ribut|rusuh|demo)/, "fire"],
  [/^(cinta|sayang|pacar|istri|suami|nikah|keluarga)/, "heart"],
  [/^(waktu|menit|detik|tahun|deadline|telat|terlambat)/, "clock"],
  [/^(ide|pikir|tips|rahasia|belajar|ilmu|paham|otak|jernih|fokus|strategi|solusi)/, "bulb"],
  [/^(aman|lindung|hukum|polisi|negara|presiden|pemerintah|privasi|data|intel|militer|tentara)/, "shield"],
  [/^(berhasil|sukses|menang|setuju|fakta|terbukti)/, "check"],
  [/^(energi|semangat|listrik|bbm|bensin|minyak|kuat|power)/, "bolt"],
  [/^(rumah|kampung|kamar|pulang)/, "home"],
];

/** Ikon untuk kata, atau null kalau kata tidak cukup bermakna. */
export const iconForWord = (word: string): IconName | null => {
  const w = normWord(word);
  if (w.length < 3) return null;
  return ICON_RULES.find(([re]) => re.test(w))?.[1] ?? null;
};
