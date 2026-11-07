import type { Camera } from "../src/types";

type Sample = { t: number; x: number; y: number; w: number; h: number; e: number };
export type FacesJson = {
  width: number;
  height: number;
  fps: number;
  duration: number;
  faceRatio: number;
  tracks: { id: number; samples: Sample[] }[];
  shots: { start: number; end: number; track: number }[];
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const NEAR = 0.45; // detik: sampel wajah dianggap "terlihat" jika sedekat ini dengan waktu frame
const FACE_FRAC = 0.2; // tinggi wajah target sebagai pecahan tinggi frame (kepala dan bahu)
const FOLLOW_TAU = 0.45; // konstanta waktu pengikutan halus (detik)

const sampleAt = (samples: Sample[], t: number): Sample | null => {
  let lo = 0;
  let hi = samples.length - 1;
  if (hi < 0) return null;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid]!.t < t) lo = mid + 1;
    else hi = mid;
  }
  const a = samples[lo]!;
  const b = samples[lo - 1];
  const best = b && Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a;
  return Math.abs(best.t - t) <= NEAR ? best : null;
};

/**
 * Bangun jalur kamera per frame:
 * - mengikuti wajah pembicara aktif (zoom menyesuaikan ukuran wajah),
 * - pindah POV dengan potongan tegas + punch-in saat pembicara atau sudut kamera berganti,
 * - sedikit "napas" zoom dan dentuman zoom pada kata penting (beats).
 */
export const buildCamera = (
  faces: FacesJson,
  fps: number,
  durationSec: number,
  beats: number[],
): Camera => {
  const W = faces.width;
  const H = faces.height;
  const base = Math.max(1080 / W, 1920 / H);
  const n = Math.max(1, Math.ceil(durationSec * fps));
  const shotTrackAt = (t: number) =>
    faces.shots.find((s) => t >= s.start && t < s.end)?.track ??
    faces.shots[faces.shots.length - 1]?.track ??
    -1;

  const cx: number[] = [];
  const cy: number[] = [];
  const z: number[] = [];

  let state = { cx: W / 2, cy: H / 2, lz: 0 };
  let target = { cx: W / 2, cy: H / 2, lz: 0 };
  let prevTrack = -2;
  let punchFrame = -1000;

  for (let f = 0; f < n; f++) {
    const t = f / fps;
    const want = shotTrackAt(t);

    const visible = faces.tracks
      .map((tr) => ({ id: tr.id, s: sampleAt(tr.samples, t) }))
      .filter((c): c is { id: number; s: Sample } => c.s !== null);
    // pembicara yang diinginkan; jika sedang tidak terlihat (sudut kamera lain), pakai wajah terbesar yang terlihat
    const pick =
      visible.find((c) => c.id === want) ??
      [...visible].sort((a, b) => b.s.w * b.s.h - a.s.w * a.s.h)[0] ??
      null;

    if (pick) {
      const s = pick.s;
      const zoom = clamp((FACE_FRAC * 1920) / s.h / base, 1, 2.4);
      target = { cx: s.x + s.w / 2, cy: s.y + s.h / 2, lz: Math.log(zoom) };
    }

    const jump = Math.abs(target.cx - state.cx) > 0.2 * W;
    const switched = pick !== null && pick.id !== prevTrack && prevTrack !== -2;
    if (f === 0 || jump || switched) {
      state = { ...target };
      if (f > 0) punchFrame = f; // potongan tegas + punch-in
    } else {
      const a = 1 - Math.exp(-1 / fps / FOLLOW_TAU);
      state.cx += (target.cx - state.cx) * a;
      state.cy += (target.cy - state.cy) * a;
      state.lz += (target.lz - state.lz) * a;
    }
    if (pick) prevTrack = pick.id;

    const sincePunch = (f - punchFrame) / fps;
    const punch =
      sincePunch >= 0 && sincePunch < 0.45
        ? 1 + 0.1 * Math.pow(1 - sincePunch / 0.45, 2)
        : 1;
    const breathe = 1 + 0.018 * Math.sin((2 * Math.PI * t) / 6.5);
    let beat = 1;
    for (const b of beats) {
      const d = t - b;
      if (d >= 0 && d < 0.35) beat = Math.max(beat, 1 + 0.05 * Math.pow(1 - d / 0.35, 2));
    }

    cx.push(Math.round(state.cx));
    cy.push(Math.round(state.cy));
    z.push(Math.round(clamp(Math.exp(state.lz) * punch * breathe * beat, 1, 2.8) * 1000) / 1000);
  }
  return { cx, cy, z };
};
