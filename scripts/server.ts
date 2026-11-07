import { spawn } from "node:child_process";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { INBOX, OUTPUT, ROOT, VIDEO_EXT, WORK } from "./config";

const PASSWORD = process.env.APP_PASSWORD;
if (!PASSWORD) {
  console.error("Set APP_PASSWORD dulu, contoh: APP_PASSWORD=rahasia npm run server");
  process.exit(1);
}
const PORT = Number(process.env.PORT ?? 8080);
const UPLOADING = path.join(INBOX, ".uploading");
const FAILED = path.join(INBOX, "failed");
await mkdir(UPLOADING, { recursive: true });
await mkdir(OUTPUT, { recursive: true });

// ---------- Unduh dari link (yt-dlp) ----------
type Download = {
  id: string;
  url: string;
  status: "menunggu" | "mengunduh" | "selesai" | "gagal";
  progress: number;
  error?: string;
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

const getState = async () => {
  let status: unknown = null;
  try {
    status = JSON.parse(await readFile(path.join(WORK, "status.json"), "utf8"));
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

  const results = [];
  for (const d of await readdir(OUTPUT, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const clips = (await listFiles(path.join(OUTPUT, d.name), [".mp4"])).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    if (clips.length === 0) continue;
    results.push({ id: d.name, mtime: Math.max(...clips.map((c) => c.mtime)), clips });
  }
  results.sort((a, b) => b.mtime - a.mtime);

  return { status, queue, failed, results, downloads };
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
    "content-type": "video/mp4",
    "accept-ranges": "bytes",
  };
  if (download) {
    headers["content-disposition"] = `attachment; filename="${path.basename(file)}"`;
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
      await rename(tmp, path.join(INBOX, finalName));
      json(res, { ok: true, name: finalName });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/link") {
      const body = JSON.parse((await readBody(req)) || "{}") as { urls?: unknown };
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

    // /files/<id>/<clip.mp4>
    if (req.method === "GET" && parts[0] === "files" && parts.length === 3) {
      const file = path.resolve(OUTPUT, parts[1]!, parts[2]!);
      if (!file.startsWith(OUTPUT + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      await serveFile(req, res, file, url.searchParams.has("download"));
      return;
    }

    // POST /api/delete/<id>
    if (req.method === "POST" && parts[0] === "api" && parts[1] === "delete" && parts[2]) {
      const dir = path.resolve(OUTPUT, parts[2]);
      if (!dir.startsWith(OUTPUT + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      await rm(dir, { recursive: true, force: true });
      await rm(path.join(ROOT, "public", "work", parts[2]), { recursive: true, force: true });
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
