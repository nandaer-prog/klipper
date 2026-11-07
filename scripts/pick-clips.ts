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
  score: number; // 1-10: seberapa cocok dengan brief dan seberapa kuat momennya
  emphasis: string[];
  broll: BRollItem[];
};

// Naikkan angka ini kalau prompt/logika berubah agar cache lama tidak dipakai
const CACHE_VERSION = 2;
const CLAUDE_TIMEOUT_MS = 6 * 60_000;
// Video lebih panjang dari ini dibagi menjadi jendela supaya prompt tetap muat
const SINGLE_PASS_SEC = 20 * 60;
const WINDOW_SEC = 15 * 60;
const WINDOW_OVERLAP_SEC = 90;
// Seberapa jauh batas dari Claude boleh digeser ke batas kata terdekat
const SNAP_SEC = 2;

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Gabungkan kata menjadi baris ber-timestamp (awal dan akhir) agar mudah dibaca Claude. */
const toTranscriptText = (captions: Caption[]) => {
  const lines: string[] = [];
  let buf = "";
  let lineStart = 0;
  let lineEnd = 0;
  const flush = () => {
    lines.push(
      `[${(lineStart / 1000).toFixed(1)}-${(lineEnd / 1000).toFixed(1)}s | ${fmt(lineStart)}] ${buf.trim()}`,
    );
    buf = "";
  };
  for (const c of captions) {
    if (!buf) lineStart = c.startMs;
    buf += c.text;
    lineEnd = c.endMs;
    if (c.endMs - lineStart > 6000 || /[.?!]\s*$/.test(c.text)) flush();
  }
  if (buf) flush();
  return lines.join("\n");
};

const askClaude = (prompt: string) =>
  new Promise<string>((resolve, reject) => {
    // --tools "": Claude hanya membalas teks, tanpa akses file/perintah
    // Di Windows (shell) string kosong harus ditulis sebagai "" agar tidak hilang
    const noTools = process.platform === "win32" ? '""' : "";
    const child = spawn("claude", ["-p", "--output-format", "text", "--tools", noTools], {
      shell: process.platform === "win32",
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Claude tidak membalas dalam ${CLAUDE_TIMEOUT_MS / 60000} menit`));
    }, CLAUDE_TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`claude exit ${code}: ${(err || out).trim().slice(0, 300)}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });

/** Ambil objek JSON pertama yang seimbang kurung kurawalnya (abaikan teks di sekitarnya). */
export const extractJson = (raw: string): unknown => {
  for (let from = raw.indexOf("{"); from >= 0; from = raw.indexOf("{", from + 1)) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = from; i < raw.length; i++) {
      const ch = raw[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        try {
          return JSON.parse(raw.slice(from, i + 1));
        } catch {
          break; // coba kurung pembuka berikutnya
        }
      }
    }
  }
  throw new Error(`Balasan Claude bukan JSON:\n${raw.slice(0, 500)}`);
};

/** Tanya Claude dan minta JSON; coba sekali lagi dengan penegasan jika balasan tidak valid. */
const askJson = async (prompt: string) => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await askClaude(
        attempt === 0 ? prompt : `${prompt}\n\nPENTING: balas HANYA dengan satu objek JSON valid, tanpa teks lain.`,
      );
      return extractJson(raw);
    } catch (e) {
      lastErr = e;
      console.warn(`Percobaan Claude ${attempt + 1} gagal:`, e instanceof Error ? e.message.slice(0, 200) : e);
    }
  }
  throw lastErr;
};

const clampN = (v: unknown, a: number, b: number, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : fb;
};

/** Rapikan B-roll dari Claude: batasi jenis, waktu, jarak, dan jumlah. */
export const cleanBroll = (raw: unknown, clipDur: number, hook = true): BRollItem[] => {
  if (!Array.isArray(raw)) return [];
  const items: BRollItem[] = [];
  const maxItems = Math.max(1, Math.floor(clipDur / 7));
  const sorted = raw
    .filter((r) => r && typeof r === "object")
    .map((r) => r as Record<string, unknown>)
    .sort((a, b) => Number(a.at) - Number(b.at));
  let lastEnd = hook ? 3.5 : 0.8; // beri ruang untuk judul hook di awal
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

/** Geser batas klip ke awal/akhir kata terdekat supaya tidak memotong kata di tengah. */
const snapToWords = (start: number, end: number, captions: Caption[], videoDur: number) => {
  let s = start;
  let e = end;
  let bestS = SNAP_SEC;
  let bestE = SNAP_SEC;
  for (const c of captions) {
    const ds = Math.abs(c.startMs / 1000 - start);
    if (ds < bestS) {
      bestS = ds;
      s = Math.max(0, c.startMs / 1000 - 0.1);
    }
    const de = Math.abs(c.endMs / 1000 - end);
    if (de < bestE) {
      bestE = de;
      e = Math.min(videoDur, c.endMs / 1000 + 0.25);
    }
  }
  return { start: Math.round(s * 10) / 10, end: Math.round(e * 10) / 10 };
};

const buildPrompt = (
  transcript: string,
  rangeText: string,
  want: number,
  videoDurationSec: number,
  settings: JobSettings,
) => `Kamu adalah editor video short-form (TikTok/Reels/Shorts) yang andal.
Berikut transkrip ${rangeText} dari video berdurasi ${Math.round(videoDurationSec)} detik. Format baris: [mulai-akhir detik | menit:detik] teks.

${transcript}

${
  settings.brief
    ? `BRIEF DARI PEMILIK VIDEO (KRITERIA UTAMA, lebih penting daripada selera umum): ${settings.brief}
Pilih hanya momen yang benar-benar sesuai brief. Di "reason" tulis satu kalimat tentang kecocokannya dengan brief. Jika momen yang cocok kurang dari jumlah diminta, kembalikan lebih sedikit saja, jangan mengisi dengan momen yang tidak relevan.
`
    : ""
}
Pilih sampai ${want} momen terbaik. Aturan:
- Durasi tiap klip antara ${settings.minSec} dan ${settings.maxSec} detik.
- Mulai dengan hook kuat (pertanyaan, klaim berani, cerita menarik), selesai di akhir kalimat/ide utuh.
- Klip harus berdiri sendiri, tidak saling tumpang tindih.
- Utamakan momen emosional, lucu, mengejutkan, atau bernilai insight/tips.
- start dan end dalam detik (desimal): start = awal baris pertama klip, end = akhir baris terakhir klip, sesuai timestamp transkrip.
- score: bilangan bulat 1-10 (10 = sangat cocok dengan brief dan sangat kuat sebagai konten).
- title: judul hook maksimal 8 kata, bahasa sama dengan transkrip, bikin penasaran.
- emphasis: 4-8 kata penting dari ucapan di klip itu (huruf kecil, persis seperti diucapkan) yang pantas ditebalkan di caption.
${
  settings.broll
    ? `- broll: daftar animasi B-roll untuk klip itu (kosongkan [] jika tidak cocok). Tiap item: {"at": detik relatif dari awal klip (mulai >= 3.5), "dur": 1.5-2.5, "type": "icon"|"stat"|"keyword"|"scene", "text": teks pendek (icon/keyword maks 3 kata, stat maks 8 karakter seperti "100%" atau "10x"), "sub": teks kecil opsional, "icon": salah satu dari ${ICONS.join(", ")}}.
  Pakai broll untuk memperjelas ucapan di momen itu (misal angka -> stat, peringatan -> icon warning, ide penting -> keyword, momen dramatis -> scene). Maksimal 1 item tiap 7 detik, jarak antar item minimal 1.5 detik.`
    : `- broll: selalu [].`
}

Balas HANYA dengan JSON valid tanpa teks lain, format:
{"clips":[{"start":12.5,"end":58.0,"score":8,"title":"...","reason":"...","emphasis":["kata","kunci"],"broll":[{"at":6.0,"dur":2.0,"type":"icon","text":"Waspada","icon":"warning"}]}]}`;

/** Bagi video panjang menjadi jendela waktu (detik) yang saling beririsan sedikit. */
const makeWindows = (durationSec: number): [number, number][] => {
  if (durationSec <= SINGLE_PASS_SEC) return [[0, durationSec]];
  const wins: [number, number][] = [];
  for (let s = 0; s < durationSec; s += WINDOW_SEC) {
    wins.push([Math.max(0, s - WINDOW_OVERLAP_SEC), Math.min(durationSec, s + WINDOW_SEC)]);
  }
  return wins;
};

/** Claude memilih momen terbaik sesuai brief + kata penting + B-roll -> work/<id>/clips.json */
export const pickClips = async (
  captions: Caption[],
  videoDurationSec: number,
  workDir: string,
  settings: JobSettings,
): Promise<ClipPlan[]> => {
  const fullText = toTranscriptText(captions);
  const sig = createHash("sha1")
    .update(
      JSON.stringify([
        CACHE_VERSION,
        settings.count,
        settings.minSec,
        settings.maxSec,
        settings.brief,
        settings.broll,
        settings.hook,
        fullText,
      ]),
    )
    .digest("hex")
    .slice(0, 16);
  const file = path.join(workDir, "clips.json");
  if (existsSync(file)) {
    const cached = JSON.parse(await readFile(file, "utf8")) as { sig?: string; clips?: ClipPlan[] };
    if (cached.sig === sig && cached.clips?.length) return cached.clips;
  }

  // 1. Kumpulkan kandidat dari tiap jendela
  const windows = makeWindows(videoDurationSec);
  const candidates: Partial<ClipPlan>[] = [];
  for (const [i, [ws, we]] of windows.entries()) {
    const part =
      windows.length === 1
        ? captions
        : captions.filter((c) => c.endMs / 1000 >= ws && c.startMs / 1000 <= we);
    if (part.length === 0) continue;
    const want =
      windows.length === 1
        ? settings.count
        : Math.min(settings.count, Math.ceil((settings.count * (we - ws)) / videoDurationSec) + 1);
    const rangeText = windows.length === 1 ? "lengkap" : `bagian ${i + 1} dari ${windows.length} (${fmt(ws * 1000)}-${fmt(we * 1000)})`;
    console.log(`Claude membaca transkrip ${rangeText}, meminta sampai ${want} momen`);
    const parsed = (await askJson(buildPrompt(toTranscriptText(part), rangeText, want, videoDurationSec, settings))) as {
      clips?: Partial<ClipPlan>[];
    };
    candidates.push(...(parsed.clips ?? []));
  }

  // 2. Rapikan batas ke kata, validasi, lalu ambil yang terbaik tanpa tumpang tindih
  type Valid = ClipPlan & { order: number };
  const normalized: Valid[] = [];
  for (const [order, c] of candidates.entries()) {
    const rawStart = Math.max(0, Number(c.start));
    const rawEnd = Math.min(videoDurationSec, Number(c.end));
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd) || rawEnd <= rawStart) {
      console.warn(`Momen dibuang: waktu tidak valid (${c.start}-${c.end})`);
      continue;
    }
    const { start, end } = snapToWords(rawStart, rawEnd, captions, videoDurationSec);
    const dur = end - start;
    if (!(dur >= settings.minSec * 0.8 && dur <= settings.maxSec * 1.15)) {
      console.warn(`Momen dibuang: durasi ${dur.toFixed(0)} detik di luar rentang (${start}-${end})`);
      continue;
    }
    normalized.push({
      order,
      start,
      end,
      title: String(c.title ?? "").trim().slice(0, 80),
      reason: String(c.reason ?? "").trim().slice(0, 300),
      score: Math.round(clampN(c.score, 1, 10, 5)),
      emphasis: Array.isArray(c.emphasis) ? c.emphasis.map((w) => String(w).toLowerCase().trim()).filter(Boolean).slice(0, 10) : [],
      broll: settings.broll ? cleanBroll(c.broll, dur, settings.hook) : [],
    });
  }
  normalized.sort((a, b) => b.score - a.score || a.order - b.order);

  const valid: ClipPlan[] = [];
  for (const c of normalized) {
    if (valid.some((v) => c.start < v.end && c.end > v.start)) {
      console.warn(`Momen dibuang: tumpang tindih (${c.start}-${c.end} "${c.title}")`);
      continue;
    }
    valid.push({ start: c.start, end: c.end, title: c.title, reason: c.reason, score: c.score, emphasis: c.emphasis, broll: c.broll });
    if (valid.length >= settings.count) break;
  }
  if (valid.length === 0) throw new Error("Tidak ada momen valid dari Claude (coba brief yang lebih umum).");

  await writeFile(file, JSON.stringify({ sig, clips: valid }, null, 2));
  return valid;
};
