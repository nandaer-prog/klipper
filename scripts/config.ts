import path from "node:path";
import type { Language, WhisperModel } from "@remotion/install-whisper-cpp";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const INBOX = process.env.INBOX_DIR
  ? path.resolve(process.env.INBOX_DIR)
  : path.join(ROOT, "inbox");
export const OUTPUT = path.join(ROOT, "output");
export const WORK = path.join(ROOT, "work");
export const WHISPER_DIR = path.join(ROOT, ".whisper");

export const WHISPER_VERSION = "1.5.5";
export const WHISPER_MODEL = (process.env.WHISPER_MODEL ??
  "small") as WhisperModel;
export const WHISPER_LANGUAGE = (process.env.WHISPER_LANGUAGE ??
  "id") as Language;

// Jumlah thread Whisper. Sisakan CPU untuk tahap lain yang berjalan bersamaan.
export const WHISPER_THREADS = process.env.WHISPER_THREADS ?? "3";
export const RENDER_CONCURRENCY = Number(process.env.RENDER_CONCURRENCY ?? 2);

export const MIN_CLIP_SEC = Number(process.env.MIN_CLIP_SEC ?? 25);
export const MAX_CLIP_SEC = Number(process.env.MAX_CLIP_SEC ?? 75);
export const MAX_CLIPS = Number(process.env.MAX_CLIPS ?? 6);
export const LAYOUT = (process.env.CLIP_LAYOUT ?? "blur-fit") as
  | "cover"
  | "blur-fit";

export const VIDEO_EXT = [".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"];
