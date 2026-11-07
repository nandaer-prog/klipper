import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { MAX_CLIP_SEC, MAX_CLIPS, MIN_CLIP_SEC } from "./config";

/** Pengaturan yang dipilih pengguna untuk satu video (dari form di ruang Aoi). */
export type JobSettings = {
  count: number;
  minSec: number;
  maxSec: number;
  brief: string;
  captionStyle: "pop" | "box" | "clean";
  faceTracking: boolean;
  broll: boolean;
  hook: boolean;
};

export const defaultSettings = (): JobSettings => ({
  count: MAX_CLIPS,
  minSec: MIN_CLIP_SEC,
  maxSec: MAX_CLIP_SEC,
  brief: "",
  captionStyle: "pop",
  faceTracking: true,
  broll: true,
  hook: true,
});

const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

/** Validasi dan bersihkan masukan dari luar (jangan percaya data dari browser). */
export const parseSettings = (raw: unknown): JobSettings => {
  const d = defaultSettings();
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const minSec = num(r.minSec, d.minSec, 5, 170);
  const maxSec = Math.max(minSec + 3, num(r.maxSec, d.maxSec, 8, 180));
  const style = String(r.captionStyle);
  return {
    count: num(r.count, d.count, 1, 20),
    minSec,
    maxSec,
    brief: String(r.brief ?? "").replace(/\s+/g, " ").trim().slice(0, 1200),
    captionStyle: style === "box" || style === "clean" ? style : "pop",
    faceTracking: r.faceTracking === undefined ? d.faceTracking : Boolean(r.faceTracking),
    broll: r.broll === undefined ? d.broll : Boolean(r.broll),
    hook: r.hook === undefined ? d.hook : Boolean(r.hook),
  };
};

/** Baca (lalu hapus) berkas pengaturan yang disimpan dashboard di samping video. */
export const takeSidecar = async (videoPath: string): Promise<JobSettings> => {
  const file = `${videoPath}.settings.json`;
  if (!existsSync(file)) return defaultSettings();
  try {
    return parseSettings(JSON.parse(await readFile(file, "utf8")));
  } catch {
    return defaultSettings();
  } finally {
    await rm(file, { force: true });
  }
};
