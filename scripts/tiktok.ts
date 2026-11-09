import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { ROOT } from "./config";

/**
 * Unggah klip ke TikTok lewat Content Posting API resmi. Jalan di PC lokal.
 *
 *   npm run tiktok -- auth                         login sekali (membuka tautan izin TikTok)
 *   npm run tiktok -- me                           cek akun + pilihan privasi yang diizinkan
 *   npm run tiktok -- post <klip.mp4> --caption "teks #tag"          pratinjau saja (tidak mengunggah)
 *   npm run tiktok -- post <klip.mp4> --caption "teks" --confirm     benar-benar unggah
 *   tambahan: --public (tayang publik, butuh app TikTok sudah lolos audit) --again (izinkan klip yang sama diunggah lagi)
 *
 * Tanpa --confirm skrip tidak pernah mengunggah. Claude hanya menambahkan --confirm setelah
 * pemilik memberi izin eksplisit di sesi chat yang ditunjuk (lihat .claude/skills/tiktok-publisher).
 *
 * Isi .env.local:
 *   TIKTOK_CLIENT_KEY=...
 *   TIKTOK_CLIENT_SECRET=...
 */
try {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
} catch {
  // pakai environment variable biasa
}

const KEY = process.env.TIKTOK_CLIENT_KEY ?? "";
const SECRET = process.env.TIKTOK_CLIENT_SECRET ?? "";
const PORT = Number(process.env.TIKTOK_CALLBACK_PORT ?? 8765);
const REDIRECT = `http://localhost:${PORT}/callback`;
const TOKEN_FILE = path.join(ROOT, ".tiktok-token.json");
const LOG_FILE = path.join(ROOT, "work", "tiktok-posted.json");
const API = process.env.TIKTOK_API ?? "https://open.tiktokapis.com";
const SCOPES = "user.info.basic,video.publish,video.upload";

type Token = { access_token: string; refresh_token: string; expires_at: number; refresh_expires_at: number; open_id: string };

const need = () => {
  if (!KEY || !SECRET) {
    console.error("Isi TIKTOK_CLIENT_KEY dan TIKTOK_CLIENT_SECRET di .env.local (lihat SETUP-VPS.md, bagian TikTok).");
    process.exit(1);
  }
};

const tokenRequest = async (params: Record<string, string>): Promise<Token> => {
  const res = await fetch(`${API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: KEY, client_secret: SECRET, ...params }),
  });
  const j = (await res.json()) as Record<string, string | number>;
  if (!res.ok || j.error || !j.access_token) {
    throw new Error(`Token TikTok ditolak: ${j.error_description ?? j.error ?? res.status}`);
  }
  const now = Date.now();
  return {
    access_token: String(j.access_token),
    refresh_token: String(j.refresh_token),
    expires_at: now + Number(j.expires_in) * 1000,
    refresh_expires_at: now + Number(j.refresh_expires_in) * 1000,
    open_id: String(j.open_id),
  };
};

const saveToken = (t: Token) => writeFile(TOKEN_FILE, JSON.stringify(t, null, 2));

const auth = async () => {
  need();
  const state = Math.random().toString(36).slice(2);
  const url =
    "https://www.tiktok.com/v2/auth/authorize/?" +
    new URLSearchParams({ client_key: KEY, scope: SCOPES, response_type: "code", redirect_uri: REDIRECT, state });
  console.log("Buka tautan ini di browser, login ke akun TikTok tujuan, lalu setujui:\n\n" + url + "\n");
  console.log(`Pastikan ${REDIRECT} terdaftar sebagai Redirect URI di TikTok Developer Portal.`);
  const code = await new Promise<string>((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url ?? "/", REDIRECT);
      if (u.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const err = u.searchParams.get("error");
      const c = u.searchParams.get("code");
      const ok = !err && c && u.searchParams.get("state") === state;
      res.writeHead(ok ? 200 : 400, { "content-type": "text/plain; charset=utf-8" });
      res.end(ok ? "Berhasil. Tutup tab ini dan kembali ke terminal." : "Gagal: " + (err ?? "state tidak cocok"));
      srv.close();
      if (ok) resolve(c);
      else reject(new Error(err ?? "state tidak cocok"));
    });
    srv.listen(PORT, "127.0.0.1");
    setTimeout(() => {
      srv.close();
      reject(new Error("Menunggu login terlalu lama (5 menit)."));
    }, 300_000);
  });
  const t = await tokenRequest({ code: decodeURIComponent(code), grant_type: "authorization_code", redirect_uri: REDIRECT });
  await saveToken(t);
  console.log("Login TikTok tersimpan di .tiktok-token.json (tidak ikut git).");
};

const getToken = async (): Promise<Token> => {
  if (!existsSync(TOKEN_FILE)) throw new Error("Belum login. Jalankan: npm run tiktok -- auth");
  let t = JSON.parse(await readFile(TOKEN_FILE, "utf8")) as Token;
  if (t.expires_at - Date.now() < 5 * 60_000) {
    if (t.refresh_expires_at < Date.now()) throw new Error("Login TikTok kedaluwarsa. Jalankan lagi: npm run tiktok -- auth");
    need();
    t = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token });
    await saveToken(t);
  }
  return t;
};

type Envelope<T> = { data?: T; error?: { code: string; message: string } };
const call = async <T>(p: string, body?: unknown): Promise<T> => {
  const t = await getToken();
  const res = await fetch(`${API}${p}`, {
    method: "POST",
    headers: { authorization: `Bearer ${t.access_token}`, "content-type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body ?? {}),
  });
  const j = (await res.json()) as Envelope<T>;
  if (!res.ok || (j.error && j.error.code !== "ok")) {
    throw new Error(`TikTok ${p}: ${j.error?.code ?? res.status} ${j.error?.message ?? ""}`.trim());
  }
  return j.data as T;
};

type Creator = { creator_username: string; creator_nickname: string; privacy_level_options: string[]; max_video_post_duration_sec: number };
const creatorInfo = () => call<Creator>("/v2/post/publish/creator_info/query/");

const me = async () => {
  const c = await creatorInfo();
  console.log(`Akun: ${c.creator_nickname} (@${c.creator_username})`);
  console.log(`Durasi maksimum: ${c.max_video_post_duration_sec} dtk`);
  console.log(`Privasi yang diizinkan: ${c.privacy_level_options.join(", ")}`);
};

const readPosted = async (): Promise<Record<string, { publishId: string; at: string; caption: string }>> => {
  try {
    return JSON.parse(await readFile(LOG_FILE, "utf8"));
  } catch {
    return {};
  }
};

const post = async (file: string, caption: string, flags: Set<string>) => {
  if (!file || !existsSync(file)) throw new Error(`Berkas klip tidak ada: ${file || "(kosong)"}`);
  if (!caption.trim()) throw new Error("Isi caption dengan --caption \"...\".");
  if (caption.length > 2200) throw new Error(`Caption ${caption.length} karakter, batas TikTok 2200.`);
  const abs = path.resolve(file);
  const { size } = await stat(abs);
  const posted = await readPosted();
  const prev = posted[abs];

  const c = await creatorInfo();
  const wantPublic = flags.has("--public");
  const privacy = wantPublic ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY";
  if (!c.privacy_level_options.includes(privacy)) {
    throw new Error(
      `Akun ini tidak boleh memakai privasi ${privacy} (pilihan: ${c.privacy_level_options.join(", ")}). ` +
        "App TikTok yang belum lolos audit hanya boleh SELF_ONLY (privat).",
    );
  }

  console.log("--- Pratinjau unggahan TikTok ---");
  console.log(`Akun    : ${c.creator_nickname} (@${c.creator_username})`);
  console.log(`Klip    : ${abs} (${(size / 1048576).toFixed(1)} MB)`);
  console.log(`Privasi : ${privacy}`);
  console.log(`Caption : ${caption}`);
  if (prev) console.log(`Catatan : klip ini sudah pernah diunggah ${prev.at} (publish_id ${prev.publishId}).`);

  if (!flags.has("--confirm")) {
    console.log("\nBELUM diunggah. Tambahkan --confirm setelah pemilik memberi izin.");
    return;
  }
  if (prev && !flags.has("--again")) throw new Error("Klip ini sudah diunggah. Pakai --again jika memang ingin mengunggah ulang.");

  // Potongan 10 MB; potongan terakhir menampung sisa (aturan TikTok: 5-64 MB, kecuali berkas kecil satu potongan)
  const chunk = size <= 10 * 1048576 ? size : 10 * 1048576;
  const total = Math.max(1, Math.floor(size / chunk));
  const init = await call<{ publish_id: string; upload_url: string }>("/v2/post/publish/video/init/", {
    post_info: { title: caption, privacy_level: privacy, disable_duet: false, disable_comment: false, disable_stitch: false },
    source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunk, total_chunk_count: total },
  });

  for (let i = 0; i < total; i++) {
    const start = i * chunk;
    const end = i === total - 1 ? size - 1 : start + chunk - 1;
    const len = end - start + 1;
    const res = await fetch(init.upload_url, {
      method: "PUT",
      headers: { "content-type": "video/mp4", "content-length": String(len), "content-range": `bytes ${start}-${end}/${size}` },
      body: Readable.toWeb(createReadStream(abs, { start, end })) as never,
      duplex: "half",
    } as RequestInit);
    if (!res.ok && res.status !== 206) throw new Error(`Unggah potongan ${i + 1}/${total} gagal: ${res.status} ${res.statusText}`);
    console.log(`Potongan ${i + 1}/${total} terkirim`);
  }

  await mkdir(path.dirname(LOG_FILE), { recursive: true });
  posted[abs] = { publishId: init.publish_id, at: new Date().toISOString(), caption };
  await writeFile(LOG_FILE, JSON.stringify(posted, null, 2));

  // Pemrosesan di sisi TikTok butuh waktu; tunggu hasilnya sebentar
  for (let n = 0; n < 24; n++) {
    const s = await call<{ status: string; fail_reason?: string }>("/v2/post/publish/status/fetch/", { publish_id: init.publish_id });
    if (s.status === "PUBLISH_COMPLETE") {
      console.log(`Selesai: klip tayang (${privacy}). publish_id ${init.publish_id}`);
      return;
    }
    if (s.status === "FAILED") throw new Error(`TikTok gagal memproses: ${s.fail_reason ?? "tanpa alasan"}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log(`Terkirim, TikTok masih memproses. publish_id ${init.publish_id}`);
};

const args = process.argv.slice(2);
const cmd = args[0];
const flags = new Set(args.filter((a) => a.startsWith("--") && a !== "--caption"));
const ci = args.indexOf("--caption");
const caption = ci >= 0 ? (args[ci + 1] ?? "") : "";
const file = args.slice(1).find((a, i, arr) => !a.startsWith("--") && arr[i - 1] !== "--caption") ?? "";

try {
  if (cmd === "auth") await auth();
  else if (cmd === "me") await me();
  else if (cmd === "post") await post(file, caption, flags);
  else {
    console.log("Pemakaian: npm run tiktok -- auth | me | post <klip.mp4> --caption \"...\" [--confirm] [--public] [--again]");
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
