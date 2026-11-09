import type { Caption } from "@remotion/captions";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Plan } from "./pipeline";
import { renderClips } from "./render-clips";
import { OUTPUT, ROOT, WORK } from "./config";

/**
 * Jalan di PC lokal (bukan VPS): ambil rencana momen + video asli dari dashboard,
 * lalu render dengan Remotion di sini.
 *
 *   npm run local                 render semua rencana yang belum dirender
 *   npm run local -- --list       lihat daftar rencana saja
 *   npm run local -- <id>         render satu rencana (ulang pun boleh)
 *   tambahkan --no-upload         jangan kirim klip jadi ke dashboard
 *
 * Isi .env.local di folder proyek:
 *   CLIPPER_URL=http://IP_VPS:8080
 *   CLIPPER_PASSWORD=password_dashboard
 */
try {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
} catch {
  // tanpa .env.local, pakai environment variable biasa
}

const NO_UPLOAD = process.argv.includes("--no-upload");
const BASE = (process.env.CLIPPER_URL ?? "").replace(/\/+$/, "");
const PASSWORD = process.env.CLIPPER_PASSWORD ?? "";
if (!BASE || !PASSWORD) {
  console.error("Isi CLIPPER_URL dan CLIPPER_PASSWORD di .env.local (lihat SETUP-VPS.md).");
  process.exit(1);
}
const AUTH = `Basic ${Buffer.from(`clipper:${PASSWORD}`).toString("base64")}`;

const api = async (p: string, init: RequestInit = {}) => {
  const res = await fetch(`${BASE}${p}`, { ...init, headers: { ...init.headers, authorization: AUTH } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${p} -> ${res.status} ${res.statusText}`);
  return res;
};

/** Unduh ke berkas; lewati jika ukurannya sudah sama dengan di server. */
const download = async (p: string, dest: string) => {
  const res = await api(p);
  const size = Number(res.headers.get("content-length") ?? -1);
  if (existsSync(dest) && size >= 0 && (await stat(dest)).size === size) return;
  const tmp = `${dest}.part`;
  let got = 0;
  let lastPct = -1;
  const body = Readable.fromWeb(res.body as never);
  body.on("data", (c: Buffer) => {
    got += c.length;
    if (size > 0) {
      const pct = Math.floor((got / size) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        process.stdout.write(`\rMengunduh ${path.basename(dest)}: ${pct}%`);
      }
    }
  });
  await pipeline(body, createWriteStream(tmp));
  process.stdout.write("\n");
  const { rename } = await import("node:fs/promises");
  await rename(tmp, dest);
};

const renderPlan = async (plan: Plan) => {
  const dir = path.join(WORK, plan.id);
  await mkdir(dir, { recursive: true });
  const videoPath = path.join(dir, plan.video);
  const idPath = encodeURIComponent(plan.id);

  console.log(`\n=== ${plan.id}: ${plan.clips.length} momen ===`);
  for (const [i, c] of plan.clips.entries()) {
    console.log(`  ${i + 1}. ${c.start.toFixed(1)}-${c.end.toFixed(1)}s [${c.score}/10] ${c.title}`);
  }

  await download(`/api/source/${idPath}`, videoPath);
  const captionsFile = path.join(dir, "captions.json");
  await writeFile(captionsFile, await (await api(`/api/plan/${idPath}/captions`)).text());
  const captions = JSON.parse(await readFile(captionsFile, "utf8")) as Caption[];

  await renderClips(plan.id, videoPath, plan.clips, captions, plan.settings);
  await api(`/api/plan/${idPath}/rendered`, { method: "POST" });
  console.log(`Selesai: output/${plan.id}/`);

  // Kirim klip jadi ke dashboard supaya bisa diunduh dari sana (gagal unggah tidak membatalkan render)
  if (!NO_UPLOAD) {
    for (const i of plan.clips.keys()) {
      const n = String(i + 1).padStart(2, "0");
      const file = path.join(OUTPUT, plan.id, `clip_${n}.mp4`);
      try {
        await uploadClip(idPath, i + 1, file);
      } catch (e) {
        console.warn(`Unggah klip ${n} gagal (klip tetap ada di ${file}):`, e instanceof Error ? e.message : e);
      }
    }
  }
};

/** Unggah satu klip hasil render ke dashboard (streaming, tidak dimuat ke memori). */
const uploadClip = async (idPath: string, n: number, file: string) => {
  const { size } = await stat(file);
  process.stdout.write(`Mengunggah klip ${n} (${(size / 1048576).toFixed(1)} MB)...`);
  const res = await fetch(`${BASE}/api/plan/${idPath}/clip/${n}/final`, {
    method: "PUT",
    headers: { authorization: AUTH, "content-type": "video/mp4" },
    body: Readable.toWeb(createReadStream(file)) as never,
    duplex: "half",
  } as RequestInit);
  if (!res.ok) throw new Error(`PUT klip ${n} -> ${res.status} ${res.statusText}`);
  process.stdout.write(" selesai\n");
};

type Row = { id: string; renderedAt: number | null; clips: unknown[] };
const state = (await (await api("/api/state")).json()) as { results: Row[] };
const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const mode = process.argv.slice(2).find((a) => a === "--list");

if (mode === "--list") {
  for (const r of state.results) {
    console.log(`${r.renderedAt ? "[sudah]" : "[baru ]"} ${r.id} (${r.clips.length} momen)`);
  }
  process.exit(0);
}

const targets = arg ? state.results.filter((r) => r.id === arg) : state.results.filter((r) => !r.renderedAt);
if (targets.length === 0) {
  console.log(arg ? `Rencana "${arg}" tidak ada di dashboard.` : "Tidak ada rencana baru untuk dirender.");
  process.exit(0);
}

let failed = 0;
for (const t of targets) {
  try {
    const plan = (await (await api(`/api/plan/${encodeURIComponent(t.id)}`)).json()) as Plan;
    await renderPlan(plan);
  } catch (e) {
    failed++;
    console.error(`[${t.id}] gagal:`, e instanceof Error ? e.message : e);
  }
}
process.exit(failed ? 1 : 0);
