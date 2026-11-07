import type { Caption } from "@remotion/captions";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_CLIP_SEC, MAX_CLIPS, MIN_CLIP_SEC } from "./config";

export type ClipPlan = {
  start: number; // detik di video asli
  end: number;
  title: string;
  reason: string;
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
    lines.push(
      `[${(lineStart / 1000).toFixed(1)}s | ${fmt(lineStart)}] ${buf.trim()}`,
    );
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
      code === 0
        ? resolve(out)
        : reject(new Error(`claude exit ${code}: ${err}`)),
    );
    child.stdin.write(prompt);
    child.stdin.end();
  });

/** Claude memilih momen terbaik -> work/<id>/clips.json */
export const pickClips = async (
  captions: Caption[],
  videoDurationSec: number,
  workDir: string,
): Promise<ClipPlan[]> => {
  const file = path.join(workDir, "clips.json");
  if (existsSync(file)) {
    return JSON.parse(await readFile(file, "utf8")) as ClipPlan[];
  }

  const prompt = `Kamu adalah editor video short-form (TikTok/Reels/Shorts).
Berikut transkrip video berdurasi ${Math.round(videoDurationSec)} detik. Format baris: [detik | menit:detik] teks.

${toTranscriptText(captions)}

Pilih maksimal ${MAX_CLIPS} momen terbaik untuk dijadikan klip pendek. Aturan:
- Durasi tiap klip ${MIN_CLIP_SEC}-${MAX_CLIP_SEC} detik.
- Mulai dengan hook kuat (pertanyaan, klaim berani, cerita menarik), selesai di akhir kalimat/ide utuh.
- Klip harus berdiri sendiri tanpa konteks lain, dan tidak saling tumpang tindih.
- Utamakan momen emosional, lucu, mengejutkan, atau bernilai insight/tips.
- start dan end dalam detik (angka desimal) sesuai timestamp transkrip.
- title: judul pendek (maks 8 kata), bahasa sama dengan transkrip, menarik perhatian.

Balas HANYA dengan JSON valid tanpa teks lain, format:
{"clips":[{"start":12.5,"end":58.0,"title":"...","reason":"..."}]}`;

  const raw = await askClaude(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Balasan Claude bukan JSON:\n${raw}`);
  const parsed = JSON.parse(match[0]) as { clips: ClipPlan[] };

  const valid: ClipPlan[] = [];
  for (const c of parsed.clips) {
    const start = Math.max(0, c.start);
    const end = Math.min(videoDurationSec, c.end);
    const dur = end - start;
    if (!(dur >= MIN_CLIP_SEC - 5 && dur <= MAX_CLIP_SEC + 10)) continue;
    if (valid.some((v) => start < v.end && end > v.start)) continue;
    valid.push({ ...c, start, end });
  }
  if (valid.length === 0) throw new Error("Tidak ada klip valid dari Claude.");

  await writeFile(file, JSON.stringify(valid, null, 2));
  return valid;
};
