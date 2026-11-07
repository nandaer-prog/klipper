import type { Caption } from "@remotion/captions";

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

export type BRollType = "icon" | "stat" | "keyword" | "scene";

/** Animasi B-roll yang muncul di waktu tertentu (detik, relatif terhadap awal klip). */
export type BRollItem = {
  at: number;
  dur: number;
  type: BRollType;
  text: string;
  sub?: string;
  icon?: IconName;
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
