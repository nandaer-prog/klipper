import path from "node:path";
import type { Language, WhisperModel } from "@remotion/install-whisper-cpp";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const INBOX = process.env.INBOX_DIR
  ? path.resolve(process.env.INBOX_DIR)
  : path.join(ROOT, "inbox");
export const OUTPUT = path.join(ROOT, "output");
// Video asli yang sudah dianalisis, disimpan di VPS sampai diambil PC lokal untuk dirender
export const LIBRARY = path.join(ROOT, "library");
export const WORK = path.join(ROOT, "work");
export const WHISPER_DIR = path.join(ROOT, ".whisper");

export const WHISPER_VERSION = "1.5.5";
// "base" cukup cepat di CPU VPS; "small" lebih akurat tetapi beberapa kali lebih lambat
export const WHISPER_MODEL = (process.env.WHISPER_MODEL ??
  "base") as WhisperModel;
export const WHISPER_LANGUAGE = (process.env.WHISPER_LANGUAGE ??
  "id") as Language;

// Jumlah thread Whisper. Sisakan CPU untuk tahap lain yang berjalan bersamaan.
export const WHISPER_THREADS = process.env.WHISPER_THREADS ?? "4";
// Beam search 1 (greedy) jauh lebih cepat di CPU VPS; naikkan ke 5 untuk akurasi lebih tinggi
export const WHISPER_BEAM = process.env.WHISPER_BEAM ?? "1";
export const RENDER_CONCURRENCY = Number(process.env.RENDER_CONCURRENCY ?? 3);
// Transkripsi dan render sama-sama berat. Di VPS dengan RAM kecil keduanya bergantian
// (tahap Claude tetap berjalan bersamaan). Set 0 untuk mengizinkan berjalan bersamaan.
export const HEAVY_EXCLUSIVE = (process.env.HEAVY_EXCLUSIVE ?? "1") === "1";

export const MIN_CLIP_SEC = Number(process.env.MIN_CLIP_SEC ?? 25);
export const MAX_CLIP_SEC = Number(process.env.MAX_CLIP_SEC ?? 75);
export const MAX_CLIPS = Number(process.env.MAX_CLIPS ?? 6);
export const LAYOUT = (process.env.CLIP_LAYOUT ?? "blur-fit") as
  | "cover"
  | "blur-fit";

export const VIDEO_EXT = [".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"];
