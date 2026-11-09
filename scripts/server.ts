import { spawn } from "node:child_process";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Caption } from "@remotion/captions";
import { sanitizeCaptions } from "./captions";
import { INBOX, LIBRARY, ROOT, VIDEO_EXT, WORK } from "./config";
import type { Plan } from "./pipeline";
import { defaultSettings, parseSettings, type JobSettings } from "./settings";

const PASSWORD = process.env.APP_PASSWORD;
if (!PASSWORD) {
  console.error("Set APP_PASSWORD dulu, contoh: APP_PASSWORD=rahasia npm run server");
  process.exit(1);
}
const PORT = Number(process.env.PORT ?? 8080);
const UPLOADING = path.join(INBOX, ".uploading");
const FAILED = path.join(INBOX, "failed");
await mkdir(UPLOADING, { recursive: true });
await mkdir(LIBRARY, { recursive: true });

// ---------- Unduh dari link (yt-dlp) ----------
type Download = {
  id: string;
  url: string;
  status: "menunggu" | "mengunduh" | "selesai" | "gagal";
  progress: number;
  error?: string;
  settings: JobSettings;
};
const downloads: Download[] = [];
let downloadChain = Promise.resolve();
const YTDLP = process.env.YTDLP ?? "yt-dlp";

const runDownload = (d: Download) =>
  new Promise<void>((resolve) => {
    d.status = "mengunduh";
    const dir = path.join(UPLOADING, `dl_${d.id}`);
    const args = [
      "--no-playlist",
      "--newline",
      "--restrict-filenames",
      "--progress-template",
      "download:%(progress._percent_str)s",
      "-f",
      "bv*[height<=1080]+ba/b[height<=1080]/b",
      "--merge-output-format",
      "mp4",
      "-o",
      path.join(dir, "%(title).80B.%(ext)s"),
    ];
    if (process.env.YTDLP_COOKIES) args.push("--cookies", process.env.YTDLP_COOKIES);
    args.push("--", d.url);

    const child = spawn(YTDLP, args);
    let err = "";
    child.stdout.on("data", (chunk: Buffer) => {
      const m = /(\d+(?:\.\d+)?)%/.exec(chunk.toString());
      if (m) d.progress = Number(m[1]);
    });
    child.stderr.on("data", (chunk: Buffer) => (err += chunk.toString()));
    child.on("error", (e) => {
      d.status = "gagal";
      d.error =
        (e as NodeJS.ErrnoException).code === "ENOENT"
          ? "yt-dlp belum terpasang di server"
          : e.message;
      resolve();
    });
    child.on("close", async (code) => {
      try {
        if (code !== 0) {
          d.status = "gagal";
          d.error = err.trim().split("\n").slice(-3).join("\n") || `yt-dlp exit ${code}`;
          return;
        }
        const files = existsSync(dir)
          ? (await readdir(dir)).filter((f) => VIDEO_EXT.includes(path.extname(f).toLowerCase()))
          : [];
        if (files.length === 0) {
          d.status = "gagal";
          d.error = "Tidak ada file video hasil unduhan";
          return;
        }
        for (const f of files) {
          const target = existsSync(path.join(INBOX, f)) ? `${Date.now()}_${f}` : f;
          await writeFile(path.join(INBOX, `${target}.settings.json`), JSON.stringify(d.settings));
          await rename(path.join(dir, f), path.join(INBOX, target));
        }
        d.status = "selesai";
        d.progress = 100;
      } finally {
        await rm(dir, { recursive: true, force: true });
        resolve();
        // buang entri lama agar daftar tidak menumpuk
        setTimeout(() => {
          const i = downloads.indexOf(d);
          if (i >= 0 && d.status === "selesai") downloads.splice(i, 1);
        }, 15000);
      }
    });
  });

const readBody = async (req: http.IncomingMessage, limit = 64 * 1024) => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw new Error("Body terlalu besar");
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString();
};

const safeEqual = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

const authorized = (req: http.IncomingMessage) => {
  const h = req.headers.authorization ?? "";
  if (!h.startsWith("Basic ")) return false;
  const decoded = Buffer.from(h.slice(6), "base64").toString();
  return safeEqual(decoded.slice(decoded.indexOf(":") + 1), PASSWORD);
};

const json = (res: http.ServerResponse, data: unknown, code = 200) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};

const listFiles = async (dir: string, exts?: string[]) => {
  if (!existsSync(dir)) return [];
  const out: { name: string; size: number; mtime: number }[] = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    if (!d.isFile()) continue;
    if (exts && !exts.includes(path.extname(d.name).toLowerCase())) continue;
    const s = await stat(path.join(dir, d.name));
    out.push({ name: d.name, size: s.size, mtime: s.mtimeMs });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
};

const planFile = (dir: string) => path.join(dir, "plan.json");

const validId = (id: string | undefined): id is string => !!id && /^[\w-]+$/.test(id);

const readPlan = async (id: string): Promise<Plan | null> => {
  try {
    return JSON.parse(await readFile(planFile(path.join(WORK, id)), "utf8")) as Plan;
  } catch {
    return null;
  }
};

const num2 = (n: number) => String(n).padStart(2, "0");
const finalFileOf = (id: string, n: number) => path.join(WORK, id, "final", `clip_${num2(n)}.mp4`);
const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** Skrip (teks ucapan) satu momen, diambil dari transkrip dengan batas yang sama seperti render. */
const clipScript = async (id: string, start: number, end: number) => {
  const caps = sanitizeCaptions(JSON.parse(await readFile(path.join(WORK, id, "captions.json"), "utf8")) as Caption[]);
  return caps
    .filter((c) => c.startMs >= start * 1000 && c.endMs <= end * 1000)
    .map((c) => c.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
};

/** Potongan mentah (belum diedit) dari video asli; dibuat sekali lalu disimpan. */
const cutJobs = new Map<string, Promise<string>>();
const ensureRawCut = (id: string, i: number, plan: Plan) => {
  const out = path.join(WORK, id, "cuts", `klip_${num2(i + 1)}.mp4`);
  if (existsSync(out)) return Promise.resolve(out);
  const key = `${id}:${i}`;
  let job = cutJobs.get(key);
  if (!job) {
    job = (async () => {
      await mkdir(path.dirname(out), { recursive: true });
      const tmp = `${out}.part.mp4`;
      const c = plan.clips[i]!;
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          "ffmpeg",
          ["-y", "-ss", String(c.start), "-to", String(c.end), "-i", path.join(LIBRARY, path.basename(plan.video)),
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-threads", "2",
            "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", tmp],
          { stdio: ["ignore", "ignore", "pipe"] },
        );
        let err = "";
        child.stderr.on("data", (d: Buffer) => (err = (err + d).slice(-800)));
        child.on("error", reject);
        child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg gagal (${code}): ${err}`))));
      });
      await rename(tmp, out);
      return out;
    })().finally(() => cutJobs.delete(key));
    cutJobs.set(key, job);
  }
  return job;
};

const getState = async () => {
  let jobs: unknown[] = [];
  try {
    const parsed = JSON.parse(await readFile(path.join(WORK, "jobs.json"), "utf8")) as {
      jobs?: unknown[];
    };
    jobs = parsed.jobs ?? [];
  } catch {
    // tidak ada proses berjalan
  }

  const queue = await listFiles(INBOX, VIDEO_EXT);
  const failed = [];
  for (const f of await listFiles(FAILED, VIDEO_EXT)) {
    let error = "";
    try {
      error = await readFile(path.join(FAILED, `${f.name}.txt`), "utf8");
    } catch {
      // tanpa catatan error
    }
    failed.push({ ...f, error });
  }

  // Rencana momen yang siap diambil PC lokal untuk dirender
  const results = [];
  for (const d of await readdir(WORK, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const plan = await readPlan(d.name);
    if (!plan || !existsSync(path.join(LIBRARY, plan.video))) continue;
    results.push({
      id: plan.id,
      mtime: plan.createdAt,
      video: plan.video,
      durationSec: plan.durationSec,
      brief: plan.settings.brief,
      renderedAt: plan.renderedAt ?? null,
      clips: plan.clips.map((c, i) => ({ ...c, final: existsSync(finalFileOf(plan.id, i + 1)) })),
    });
  }
  results.sort((a, b) => b.mtime - a.mtime);

  return { jobs, queue, failed, results, downloads, defaults: defaultSettings() };
};

const cleanName = (raw: string) => {
  const base = path.basename(decodeURIComponent(raw)).replace(/[^\w.\- ()]+/g, "_");
  return base || "video.mp4";
};

const serveFile = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  file: string,
  download: boolean,
  contentType = "video/mp4",
  downloadName?: string,
) => {
  let s;
  try {
    s = await stat(file);
    if (!s.isFile()) throw new Error();
  } catch {
    res.writeHead(404).end("Tidak ditemukan");
    return;
  }
  const headers: Record<string, string | number> = {
    "content-type": contentType,
    "accept-ranges": "bytes",
  };
  if (download) {
    headers["content-disposition"] = `attachment; filename="${downloadName ?? path.basename(file)}"`;
  }
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (m) {
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Math.min(Number(m[2]), s.size - 1) : s.size - 1;
    if (start > end || start >= s.size) {
      res.writeHead(416, { "content-range": `bytes */${s.size}` }).end();
      return;
    }
    res.writeHead(206, {
      ...headers,
      "content-range": `bytes ${start}-${end}/${s.size}`,
      "content-length": end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, "content-length": s.size });
  createReadStream(file).pipe(res);
};

const server = http.createServer(async (req, res) => {
  try {
    if (!authorized(req)) {
      res
        .writeHead(401, { "www-authenticate": 'Basic realm="Clipper"' })
        .end("Perlu login");
      return;
    }
    const url = new URL(req.url ?? "/", "http://x");
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

    if (req.method === "GET" && url.pathname === "/") {
      const html = await readFile(path.join(ROOT, "scripts", "ui.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
      return;
    }

    // three.js disajikan dari server sendiri (tanpa CDN luar yang bisa terblokir)
    if (req.method === "GET" && parts[0] === "vendor" && parts[1] === "three") {
      const rel = parts.slice(2).join("/");
      if (
        !/^(build\/three\.module\.js|examples\/jsm\/controls\/OrbitControls\.js)$/.test(rel)
      ) {
        res.writeHead(404).end("Tidak ditemukan");
        return;
      }
      const js = await readFile(path.join(ROOT, "node_modules", "three", rel));
      res
        .writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "public, max-age=86400",
        })
        .end(js);
      return;
    }

    if (req.method === "GET" && url.pathname === "/studio.js") {
      const js = await readFile(path.join(ROOT, "scripts", "studio.js"));
      res
        .writeHead(200, { "content-type": "text/javascript; charset=utf-8" })
        .end(js);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      json(res, await getState());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/upload") {
      const name = cleanName(String(req.headers["x-filename"] ?? "video.mp4"));
      if (!VIDEO_EXT.includes(path.extname(name).toLowerCase())) {
        json(res, { error: "Format tidak didukung" }, 400);
        return;
      }
      const stamp = `${Date.now()}_${name}`;
      const tmp = path.join(UPLOADING, stamp);
      try {
        await pipeline(req, createWriteStream(tmp));
      } catch (e) {
        await rm(tmp, { force: true });
        throw e;
      }
      // Pindah setelah selesai, agar watcher tidak mengambil file setengah jadi
      const finalName = existsSync(path.join(INBOX, name)) ? stamp : name;
      // pengaturan sidecar ditulis SEBELUM file masuk inbox agar watcher tidak mengambilnya tanpa pengaturan
      let settings = defaultSettings();
      try {
        settings = parseSettings(JSON.parse(decodeURIComponent(String(req.headers["x-settings"] ?? "{}"))));
      } catch {
        // pakai pengaturan bawaan
      }
      await writeFile(path.join(INBOX, `${finalName}.settings.json`), JSON.stringify(settings));
      await rename(tmp, path.join(INBOX, finalName));
      json(res, { ok: true, name: finalName });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/link") {
      const body = JSON.parse((await readBody(req)) || "{}") as { urls?: unknown; settings?: unknown };
      const settings = parseSettings(body.settings);
      const urls = (Array.isArray(body.urls) ? body.urls : [])
        .map((u) => String(u).trim())
        .filter(Boolean)
        .slice(0, 20);
      const accepted: string[] = [];
      for (const u of urls) {
        let parsed: URL;
        try {
          parsed = new URL(u);
        } catch {
          continue;
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
        const d: Download = {
          id: randomUUID(),
          url: parsed.href,
          status: "menunggu",
          progress: 0,
          settings,
        };
        downloads.unshift(d);
        downloadChain = downloadChain.then(() => runDownload(d));
        accepted.push(d.url);
      }
      json(res, { ok: accepted.length > 0, accepted: accepted.length });
      return;
    }

    // POST /api/dismiss/<id> : buang entri unduhan gagal dari daftar
    if (req.method === "POST" && parts[0] === "api" && parts[1] === "dismiss" && parts[2]) {
      const i = downloads.findIndex((d) => d.id === parts[2] && d.status === "gagal");
      if (i >= 0) downloads.splice(i, 1);
      json(res, { ok: true });
      return;
    }

    // GET /api/plan/<id> : rencana momen (JSON) untuk PC lokal
    // GET /api/plan/<id>/captions : transkrip per kata
    // GET /api/source/<id> : video asli (mendukung Range)
    // POST /api/plan/<id>/rendered : PC lokal menandai rencana sudah dirender
    if (parts[0] === "api" && (parts[1] === "plan" || parts[1] === "source") && validId(parts[2])) {
      const id = parts[2];
      const plan = await readPlan(id);
      if (!plan) {
        res.writeHead(404).end("Rencana tidak ditemukan");
        return;
      }
      if (req.method === "GET" && parts[1] === "plan" && parts.length === 3) {
        json(res, plan);
        return;
      }
      if (req.method === "GET" && parts[1] === "plan" && parts[3] === "captions") {
        await serveFile(req, res, path.join(WORK, id, "captions.json"), false, "application/json");
        return;
      }
      // /api/plan/<id>/clip/<n>/(prepare|video|script|final)
      if (parts[1] === "plan" && parts[3] === "clip") {
        const idx = Number(parts[4]) - 1;
        const clip = Number.isInteger(idx) ? plan.clips[idx] : undefined;
        if (!clip) {
          res.writeHead(404).end("Klip tidak ditemukan");
          return;
        }
        const n = idx + 1;
        const action = parts[5];
        const finalFile = finalFileOf(id, n);
        // PC lokal mengunggah klip hasil render supaya bisa diunduh dari dashboard
        if (req.method === "PUT" && action === "final") {
          await mkdir(path.dirname(finalFile), { recursive: true });
          const tmp = `${finalFile}.part`;
          try {
            await pipeline(req, createWriteStream(tmp));
          } catch (e) {
            await rm(tmp, { force: true });
            throw e;
          }
          await rename(tmp, finalFile);
          json(res, { ok: true });
          return;
        }
        if (req.method === "GET" && action === "script") {
          const text = await clipScript(id, clip.start, clip.end);
          if (!url.searchParams.has("download")) {
            json(res, { text });
            return;
          }
          const body = [
            `Judul: ${clip.title}`,
            `Video: ${id}`,
            `Klip: ${n} dari ${plan.clips.length}`,
            `Waktu: ${fmtTime(clip.start)}-${fmtTime(clip.end)} (${Math.round(clip.end - clip.start)} detik)`,
            clip.reason ? `Alasan dipilih: ${clip.reason}` : "",
            clip.emphasis.length ? `Kata penting: ${clip.emphasis.join(", ")}` : "",
            "",
            "Skrip:",
            text || "(tidak ada ucapan terdeteksi)",
            "",
          ]
            .filter((l, i, a) => l !== "" || a[i - 1] !== "")
            .join("\n");
          res
            .writeHead(200, {
              "content-type": "text/plain; charset=utf-8",
              "content-disposition": `attachment; filename="${id}_klip${num2(n)}_skrip.txt"`,
            })
            .end(body);
          return;
        }
        if (req.method === "GET" && (action === "prepare" || action === "video")) {
          const isFinal = existsSync(finalFile);
          const file = isFinal ? finalFile : await ensureRawCut(id, idx, plan);
          if (action === "prepare") {
            json(res, { ok: true, kind: isFinal ? "final" : "raw" });
            return;
          }
          await serveFile(req, res, file, url.searchParams.has("download"), "video/mp4", `${id}_klip${num2(n)}${isFinal ? "" : "_mentah"}.mp4`);
          return;
        }
      }
      if (req.method === "GET" && parts[1] === "source") {
        await serveFile(req, res, path.join(LIBRARY, path.basename(plan.video)), url.searchParams.has("download"));
        return;
      }
      if (req.method === "POST" && parts[1] === "plan" && parts[3] === "rendered") {
        plan.renderedAt = Date.now();
        await writeFile(planFile(path.join(WORK, id)), JSON.stringify(plan, null, 2));
        json(res, { ok: true });
        return;
      }
    }

    // POST /api/delete/<id> : hapus rencana, transkrip, dan video asli
    if (req.method === "POST" && parts[0] === "api" && parts[1] === "delete" && validId(parts[2])) {
      const plan = await readPlan(parts[2]);
      if (plan) await rm(path.join(LIBRARY, path.basename(plan.video)), { force: true });
      await rm(path.join(WORK, parts[2]), { recursive: true, force: true });
      json(res, { ok: true });
      return;
    }

    res.writeHead(404).end("Tidak ditemukan");
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, { error: "Server error" }, 500);
    else res.end();
  }
});

server.requestTimeout = 0; // upload video besar boleh lama
server.listen(PORT, () => console.log(`Dashboard: http://0.0.0.0:${PORT}`));
