import type { Caption } from "@remotion/captions";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ICONS, type BRollItem } from "../src/types";
import type { JobSettings } from "./settings";

export type ClipPlan = {
  start: number; // detik di video asli
  end: number;
  title: string;
  reason: string;
  emphasis: string[];
  broll: BRollItem[];
};

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Gabungkan kata menjadi baris ber-timestamp agar mudah dibaca Claude. */
const toTranscriptText = (captions: Caption[]) => {
  const lines: string[] = [];
  let buf = "";
  let lineStart = 0;
  const flush = () => {
    lines.push(`[${(lineStart / 1000).toFixed(1)}s | ${fmt(lineStart)}] ${buf.trim()}`);
    buf = "";
  };
  for (const c of captions) {
    if (!buf) lineStart = c.startMs;
    buf += c.text;
    if (c.endMs - lineStart > 6000 || /[.?!]\s*$/.test(c.text)) flush();
  }
  if (buf) flush();
  return lines.join("\n");
};

const askClaude = (prompt: string) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn("claude", ["-p", "--output-format", "text"], {
      shell: process.platform === "win32",
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`claude exit ${code}: ${err}`)),
    );
    child.stdin.write(prompt);
    child.stdin.end();
  });

const clampN = (v: unknown, a: number, b: number, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : fb;
};

/** Rapikan B-roll dari Claude: batasi jenis, waktu, jarak, dan jumlah. */
export const cleanBroll = (raw: unknown, clipDur: number): BRollItem[] => {
  if (!Array.isArray(raw)) return [];
  const items: BRollItem[] = [];
  const maxItems = Math.max(1, Math.floor(clipDur / 7));
  const sorted = raw
    .filter((r) => r && typeof r === "object")
    .map((r) => r as Record<string, unknown>)
    .sort((a, b) => Number(a.at) - Number(b.at));
  let lastEnd = 3.2; // beri ruang untuk judul hook di awal
  for (const r of sorted) {
    const type = ["icon", "stat", "keyword", "scene"].includes(String(r.type)) ? (String(r.type) as BRollItem["type"]) : "icon";
    const dur = clampN(r.dur, 1.4, type === "scene" ? 2.4 : 3, 2);
    const at = clampN(r.at, 0, clipDur, 0);
    const text = String(r.text ?? "").replace(/\s+/g, " ").trim().slice(0, 28);
    if (!text || at < lastEnd || at + dur > clipDur - 0.6 || items.length >= maxItems) continue;
    const icon = ICONS.includes(r.icon as never) ? (r.icon as BRollItem["icon"]) : "star";
    const sub = r.sub ? String(r.sub).replace(/\s+/g, " ").trim().slice(0, 30) : undefined;
    items.push({ at: Math.round(at * 10) / 10, dur: Math.round(dur * 10) / 10, type, text, sub, icon });
    lastEnd = at + dur + 1.2;
  }
  return items;
};

/** Claude memilih momen terbaik + kata penting + B-roll -> work/<id>/clips.json */
export const pickClips = async (
  captions: Caption[],
  videoDurationSec: number,
  workDir: string,
  settings: JobSettings,
): Promise<ClipPlan[]> => {
  const transcript = toTranscriptText(captions);
  const sig = createHash("sha1")
    .update(JSON.stringify([settings.count, settings.minSec, settings.maxSec, settings.brief, settings.broll, transcript.length]))
    .digest("hex")
    .slice(0, 12);
  const file = path.join(workDir, "clips.json");
  if (existsSync(file)) {
    const cached = JSON.parse(await readFile(file, "utf8")) as { sig?: string; clips?: ClipPlan[] };
    if (cached.sig === sig && cached.clips?.length) return cached.clips;
  }

  const prompt = `Kamu adalah editor video short-form (TikTok/Reels/Shorts) yang andal.
Berikut transkrip video berdurasi ${Math.round(videoDurationSec)} detik. Format baris: [detik | menit:detik] teks.

${transcript}

${settings.brief ? `BRIEF DARI PEMILIK VIDEO (utamakan ini): ${settings.brief}\n` : ""}
Pilih ${settings.count} momen terbaik (boleh lebih sedikit jika kontennya memang tidak cukup bagus). Aturan:
- Durasi tiap klip antara ${settings.minSec} dan ${settings.maxSec} detik.
- Mulai dengan hook kuat (pertanyaan, klaim berani, cerita menarik), selesai di akhir kalimat/ide utuh.
- Klip harus berdiri sendiri, tidak saling tumpang tindih. Urutkan dari yang terbaik.
- Utamakan momen emosional, lucu, mengejutkan, atau bernilai insight/tips.
- start dan end dalam detik (desimal) sesuai timestamp transkrip.
- title: judul hook maksimal 8 kata, bahasa sama dengan transkrip, bikin penasaran.
- emphasis: 4-8 kata penting dari ucapan di klip itu (huruf kecil, persis seperti diucapkan) yang pantas ditebalkan di caption.
${
  settings.broll
    ? `- broll: daftar animasi B-roll untuk klip itu (kosongkan [] jika tidak cocok). Tiap item: {"at": detik relatif dari awal klip (mulai >= 3.5), "dur": 1.5-2.5, "type": "icon"|"stat"|"keyword"|"scene", "text": teks pendek (icon/keyword maks 3 kata, stat maks 8 karakter seperti "100%" atau "10x"), "sub": teks kecil opsional, "icon": salah satu dari ${ICONS.join(", ")}}.
  Pakai broll untuk memperjelas ucapan di momen itu (misal angka -> stat, peringatan -> icon warning, ide penting -> keyword, momen dramatis -> scene). Maksimal 1 item tiap 7 detik, jarak antar item minimal 1.5 detik.`
    : `- broll: selalu [].`
}

Balas HANYA dengan JSON valid tanpa teks lain, format:
{"clips":[{"start":12.5,"end":58.0,"title":"...","reason":"...","emphasis":["kata","kunci"],"broll":[{"at":6.0,"dur":2.0,"type":"icon","text":"Waspada","icon":"warning"}]}]}`;

  const raw = await askClaude(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Balasan Claude bukan JSON:\n${raw}`);
  const parsed = JSON.parse(match[0]) as { clips: Partial<ClipPlan>[] };

  const valid: ClipPlan[] = [];
  for (const c of parsed.clips ?? []) {
    const start = Math.max(0, Number(c.start));
    const end = Math.min(videoDurationSec, Number(c.end));
    const dur = end - start;
    if (!Number.isFinite(dur)) continue;
    if (!(dur >= settings.minSec * 0.8 && dur <= settings.maxSec * 1.15)) continue;
    if (valid.some((v) => start < v.end && end > v.start)) continue;
    valid.push({
      start,
      end,
      title: String(c.title ?? "").trim().slice(0, 80),
      reason: String(c.reason ?? ""),
      emphasis: Array.isArray(c.emphasis) ? c.emphasis.map((w) => String(w).toLowerCase().trim()).filter(Boolean).slice(0, 10) : [],
      broll: settings.broll ? cleanBroll(c.broll, dur) : [],
    });
    if (valid.length >= settings.count) break;
  }
  if (valid.length === 0) throw new Error("Tidak ada klip valid dari Claude.");

  await writeFile(file, JSON.stringify({ sig, clips: valid }, null, 2));
  return valid;
};
