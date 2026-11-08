import type { Caption } from "@remotion/captions";
import type { Tone } from "./tone";

/** Jalur kamera per frame: titik pusat di video sumber (piksel) dan zoom. */
export type Camera = { cx: number[]; cy: number[]; z: number[] };

export const ICONS = [
  "fire",
  "warning",
  "money",
  "heart",
  "star",
  "check",
  "bolt",
  "clock",
  "bulb",
  "shield",
  "home",
] as const;
export type IconName = (typeof ICONS)[number];

/** Ikon aplikasi generik untuk B-roll `card` dan `orbit` (bukan logo merek dagang). */
export const APP_ICONS = ["chat", "spark", "folder", "sheet", "chip", "ads"] as const;
export type AppIconName = (typeof APP_ICONS)[number];

/**
 * icon/stat/keyword/scene: animasi dasar. prompt: layar tiruan prompt AI yang diketik.
 * card: kartu berita dengan ikon mengambang. orbit: ikon AI di tengah dengan ikon aplikasi mengorbit.
 */
export type BRollType = "icon" | "stat" | "keyword" | "scene" | "prompt" | "card" | "orbit";

/** Animasi B-roll yang muncul di waktu tertentu (detik, relatif terhadap awal klip). */
export type BRollItem = {
  at: number;
  dur: number;
  type: BRollType;
  text: string;
  sub?: string;
  icon?: IconName;
  /** Ikon aplikasi untuk `card` (mengambang) dan `orbit` (mengorbit); kosong = bawaan */
  icons?: AppIconName[];
  /** Nomor lencana merah pada `prompt` (langkah 1, 2, 3) */
  badge?: number;
  /** Path footage (relatif terhadap public/) untuk cutaway `scene`; kosong = animasi */
  footage?: string;
};

export type CaptionStyle = "pop" | "box" | "clean" | "karaoke";

export type ClipProps = {
  /** Path relatif terhadap folder public/, misal "work/video1/clip_01.mp4" */
  src: string;
  srcWidth: number;
  srcHeight: number;
  /** camera = video asli + kamera pintar (face tracking); composite = video sudah disusun FFmpeg */
  mode: "camera" | "composite";
  camera: Camera | null;
  /** Caption dengan timestamp relatif terhadap awal klip */
  captions: Caption[];
  /** Kata yang dipertegas (warna dan ukuran berbeda) */
  emphasis: string[];
  captionStyle: CaptionStyle;
  title: string;
  hook: boolean;
  broll: BRollItem[];
  durationInSeconds: number;
  accent: string;
  /** Nada klip untuk memilih paket gaya animasi; kosong = ditebak dari kata-kata dan judul klip */
  tone?: Tone;
};

export const defaultClipProps: ClipProps = {
  src: "",
  srcWidth: 1920,
  srcHeight: 1080,
  mode: "composite",
  camera: null,
  captions: [],
  emphasis: [],
  captionStyle: "pop",
  title: "",
  hook: true,
  broll: [],
  durationInSeconds: 10,
  accent: "#FFE600",
};
