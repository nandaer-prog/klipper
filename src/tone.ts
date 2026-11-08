import type { Caption } from "@remotion/captions";
import { normWord, toWords } from "./wordIcons";

/** Nada klip: menentukan paket gaya animasi yang pantas untuk isinya. */
export type Tone = "serius" | "edukasi" | "santai";

/** Awal kata yang menandai tiap nada. Sengaja hanya kata bermakna kuat. */
const RULES: Record<Tone, RegExp> = {
  serius:
    /^(sadap|penyadap|disadap|skandal|korupsi|makar|kudeta|triliun|presiden|polisi|kapolri|hukum|tersangka|bocor|retas|ancam|bahaya|krisis|intel|pidana|tipu|curang|mafia|oligarki|negara|pemerintah|militer|tentara|pelanggaran|korban|tewas|bunuh|perang|darurat|dilacak|melacak|spion)/,
  edukasi:
    /^(cara|tips|belajar|langkah|metode|rahasia|strategi|fakta|ilmu|penjelasan|artinya|sebab|alasan|kenapa|bagaimana|manfaat|jernih|fokus|sehat|dokter|otak|riset|penelitian|data|contoh|panduan|solusi)/,
  santai:
    /^(lucu|ngakak|gokil|kocak|receh|bercanda|haha|wkwk|seru|asik|santai|jajan|ngeles|nyebelin|baper|gemes|konyol|pisang|meme|cuek|bodo|rame|heboh)/,
};

/**
 * Tebak nada klip dari kata-kata yang diucapkan dan judulnya. Judul bernilai dua kali lipat.
 * Seri atau tanpa petunjuk -> "edukasi" (paling netral). `confidence` 0..1 untuk mengukur seberapa jelas.
 */
export const detectTone = (captions: Caption[], title: string): { tone: Tone; confidence: number; scores: Record<Tone, number> } => {
  const scores: Record<Tone, number> = { serius: 0, edukasi: 0, santai: 0 };
  const count = (w: string, weight: number) => {
    const n = normWord(w);
    if (n.length < 3) return;
    (Object.keys(RULES) as Tone[]).forEach((t) => {
      if (RULES[t].test(n)) scores[t] += weight;
    });
  };
  toWords(captions).forEach((w) => count(w.text, 1));
  title.split(/\s+/).forEach((w) => count(w, 2));
  const order = (Object.keys(scores) as Tone[]).sort((a, b) => scores[b] - scores[a]);
  const [top, second] = order as [Tone, Tone];
  const total = scores.serius + scores.edukasi + scores.santai;
  if (total < 3 || scores[top] === scores[second]) return { tone: "edukasi", confidence: 0, scores };
  return { tone: top, confidence: (scores[top] - scores[second]) / total, scores };
};

export type KeywordStyle = "stretch" | "ransom" | "snap" | "slide" | "glitch";
export type SceneBgKind = "gradient" | "tunnel" | "grid" | "riso";
type StickerCycle = ("rec" | "eyes" | "peek" | "money" | "icon")[];

/**
 * Paket gaya per nada: gaya keyword, latar scene, kertas huruf ransom yang boleh dipakai, dan
 * stiker yang dipakai untuk kata pengawasan (surveil) dan kata uang (money). Karakter lucu
 * (makhluk mengintip, maskot uang) tidak dipakai di nada serius.
 */
export const TONE_STYLE: Record<
  Tone,
  { keyword: readonly KeywordStyle[]; sceneBg: readonly SceneBgKind[]; ransomPapers: readonly number[]; surveil: StickerCycle; money: StickerCycle }
> = {
  // gelap dan tegas; huruf ransom hanya dari kertas koran, kraft, hitam, abu-abu
  serius: { keyword: ["ransom", "glitch", "slide", "snap"], sceneBg: ["tunnel", "grid", "gradient"], ransomPapers: [0, 1, 2, 5], surveil: ["rec", "eyes"], money: ["icon"] },
  // bersih dan jelas; ransom tidak dipakai
  edukasi: { keyword: ["stretch", "slide", "snap"], sceneBg: ["gradient", "grid"], ransomPapers: [0, 1, 2, 5], surveil: ["rec", "icon"], money: ["icon", "money"] },
  // ceria dan berwarna; semua kertas, latar riso
  santai: { keyword: ["stretch", "snap", "ransom"], sceneBg: ["riso", "gradient"], ransomPapers: [0, 1, 2, 3, 4, 5, 6, 7], surveil: ["peek", "eyes", "rec"], money: ["money", "icon"] },
};
