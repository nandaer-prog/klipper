import type { Caption } from "@remotion/captions";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ClipProps } from "../src/types";
import { buildCamera, type FacesJson } from "./camera";
import { sanitizeCaptions } from "./captions";
import { LAYOUT, OUTPUT, RENDER_CONCURRENCY, ROOT } from "./config";
import type { ClipPlan } from "./pick-clips";
import type { JobSettings } from "./settings";
import { setJob } from "./status";

const FPS = 30;
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

const run = (cmd: string, args: string[], timeoutMs = 20 * 60_000) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stderr.on("data", (d) => (err = (err + d).slice(-1500)));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${cmd} gagal (${code}): ${err}`));
    });
  });

/** Latar blur (atau crop tengah) dibuat FFmpeg: jauh lebih ringan daripada blur CSS di Chrome. */
const compositeFilter = (layout: "cover" | "blur-fit") =>
  layout === "cover"
    ? "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p[v]"
    : [
        "[0:v]split=2[a][b]",
        "[a]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=6:2,eq=brightness=-0.12,scale=1080:1920:flags=bilinear[bg]",
        "[b]scale=1080:1920:force_original_aspect_ratio=decrease[fg]",
        "[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=30,format=yuv420p[v]",
      ].join(";");

const ffmpegCut = (videoPath: string, clip: ClipPlan, out: string, filterArgs: string[]) =>
  run("ffmpeg", [
    "-y", "-ss", String(clip.start), "-to", String(clip.end), "-i", videoPath,
    ...filterArgs,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-threads", "3",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out,
  ]);

const pythonBin = () =>
  process.env.PYTHON ??
  [path.join(ROOT, ".venv", "bin", "python"), path.join(ROOT, ".venv", "Scripts", "python.exe")].find(existsSync) ??
  "python3";

/** Analisis wajah + pembicara aktif. Mengembalikan null jika alatnya tidak tersedia. */
const analyzeFaces = async (videoPath: string, clip: ClipPlan, out: string): Promise<FacesJson | null> => {
  try {
    await run(pythonBin(), [path.join(ROOT, "scripts", "faces.py"), videoPath, out, String(clip.start), String(clip.end)], 8 * 60_000);
    return JSON.parse(await readFile(out, "utf8")) as FacesJson;
  } catch (e) {
    console.warn("Analisis wajah dilewati:", e instanceof Error ? e.message.slice(0, 200) : e);
    return null;
  }
};

export const renderClips = async (
  id: string,
  videoPath: string,
  clips: ClipPlan[],
  captions: Caption[],
  settings: JobSettings,
) => {
  const segDir = path.join(ROOT, "public", "work", id);
  const outDir = path.join(OUTPUT, id);
  await mkdir(segDir, { recursive: true });
  await mkdir(outDir, { recursive: true });
  captions = sanitizeCaptions(captions);

  // 1. Per klip: analisis wajah -> pilih mode kamera pintar atau komposit FFmpeg
  const items: { n: string; props: ClipProps }[] = [];
  for (const [i, clip] of clips.entries()) {
    const n = String(i + 1).padStart(2, "0");
    const dur = clip.end - clip.start;
    const label = `klip ${i + 1} dari ${clips.length}`;

    let faces: FacesJson | null = null;
    if (settings.faceTracking) {
      await setJob(id, { stage: "Render klip", detail: `Menganalisis wajah ${label}` });
      faces = await analyzeFaces(videoPath, clip, path.join(segDir, `faces_${n}.json`));
    }
    const useCamera = !!faces && faces.faceRatio >= 0.5 && faces.tracks.length > 0;

    await setJob(id, { stage: "Render klip", detail: `Menyiapkan ${label}` });
    const rel = `work/${id}/clip_${n}.mp4`;
    const abs = path.join(ROOT, "public", rel);

    // kata penting -> waktu dentuman zoom
    const emph = new Set(clip.emphasis.map(norm).filter(Boolean));
    const startMs = clip.start * 1000;
    const endMs = clip.end * 1000;
    const clipCaptions: Caption[] = captions
      .filter((c) => c.startMs >= startMs && c.endMs <= endMs)
      .map((c) => ({
        ...c,
        startMs: c.startMs - startMs,
        endMs: c.endMs - startMs,
        timestampMs: c.timestampMs === null ? null : c.timestampMs - startMs,
      }));
    const beats = clipCaptions.filter((c) => emph.has(norm(c.text))).map((c) => c.startMs / 1000);

    const common = {
      captions: clipCaptions,
      emphasis: clip.emphasis,
      captionStyle: settings.captionStyle,
      title: clip.title,
      hook: settings.hook,
      broll: clip.broll,
      durationInSeconds: dur,
      accent: "#FFE600",
    };

    if (useCamera && faces) {
      // video asli (maks 1920 lebar); Remotion yang menggeser dan zoom mengikuti wajah
      const w = Math.min(1920, faces.width);
      const h = Math.round((faces.height * w) / faces.width / 2) * 2;
      await ffmpegCut(videoPath, clip, abs, ["-vf", `scale=${w}:${h},fps=${FPS},format=yuv420p`]);
      const k = w / faces.width;
      const cam = buildCamera(faces, FPS, dur, beats);
      items.push({
        n,
        props: {
          ...common,
          src: rel,
          srcWidth: w,
          srcHeight: h,
          mode: "camera",
          camera: { cx: cam.cx.map((v) => Math.round(v * k)), cy: cam.cy.map((v) => Math.round(v * k)), z: cam.z },
        },
      });
    } else {
      await ffmpegCut(videoPath, clip, abs, ["-filter_complex", compositeFilter(LAYOUT), "-map", "[v]", "-map", "0:a?"]);
      items.push({
        n,
        props: { ...common, src: rel, srcWidth: 1080, srcHeight: 1920, mode: "composite", camera: null },
      });
    }
    console.log(`[${id}] klip ${n}: mode ${useCamera ? "kamera pintar" : "komposit"}${faces ? ` (wajah ${Math.round(faces.faceRatio * 100)}%, ${faces.shots.length} shot)` : ""}`);
  }

  // 2. Bundle sekali (setelah segmen dibuat), lalu render semua klip
  await setJob(id, { stage: "Render klip", detail: "Menyiapkan render" });
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    publicDir: path.join(ROOT, "public"),
  });

  for (const [index, { n, props }] of items.entries()) {
    let lastPct = -1;
    const composition = await selectComposition({ serveUrl, id: "Clip", inputProps: props });
    const outputLocation = path.join(outDir, `clip_${n}.mp4`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps: props,
      concurrency: RENDER_CONCURRENCY,
      onProgress: ({ progress }) => {
        const pct = Math.round(progress * 100);
        process.stdout.write(`\rRender klip ${n}: ${pct}%`);
        if (pct !== lastPct) {
          lastPct = pct;
          void setJob(id, {
            stage: "Render klip",
            detail: `Klip ${index + 1} dari ${items.length}: ${pct}%`,
          });
        }
      },
    });
    process.stdout.write("\n");
    console.log(`Selesai: ${outputLocation}`);
  }
};
