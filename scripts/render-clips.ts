import type { Caption } from "@remotion/captions";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { ClipProps } from "../src/types";
import { LAYOUT, OUTPUT, RENDER_CONCURRENCY, ROOT } from "./config";
import { sanitizeCaptions } from "./captions";
import type { ClipPlan } from "./pick-clips";
import { setJob } from "./status";

/**
 * Potong satu klip menjadi video 1080x1920 yang sudah jadi (latar blur atau crop tengah)
 * langsung lewat FFmpeg. Cara ini jauh lebih ringan daripada mem-blur video di Chrome
 * untuk setiap frame, sehingga cukup cepat di VPS tanpa GPU.
 */
const filterFor = (layout: "cover" | "blur-fit") =>
  layout === "cover"
    ? "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p[v]"
    : [
        "[0:v]split=2[a][b]",
        // latar: perkecil, blur, gelapkan sedikit, lalu perbesar (murah tapi tampak lembut)
        "[a]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=6:2,eq=brightness=-0.12,scale=1080:1920:flags=bilinear[bg]",
        "[b]scale=1080:1920:force_original_aspect_ratio=decrease[fg]",
        "[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=30,format=yuv420p[v]",
      ].join(";");

const cutClip = (videoPath: string, clip: ClipPlan, out: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(clip.start),
        "-to",
        String(clip.end),
        "-i",
        videoPath,
        "-filter_complex",
        filterFor(LAYOUT),
        "-map",
        "[v]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "21",
        "-threads",
        "3",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        out,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let err = "";
    child.stderr.on("data", (d) => (err = (err + d).slice(-1500)));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg gagal (${code}): ${err}`)),
    );
  });

export const renderClips = async (
  id: string,
  videoPath: string,
  clips: ClipPlan[],
  captions: Caption[],
) => {
  const segDir = path.join(ROOT, "public", "work", id);
  const outDir = path.join(OUTPUT, id);
  await mkdir(segDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  captions = sanitizeCaptions(captions);

  // 1. Potong dan susun latar dengan FFmpeg (tanpa memblokir proses lain)
  const items: { n: string; props: ClipProps }[] = [];
  for (const [i, clip] of clips.entries()) {
    const n = String(i + 1).padStart(2, "0");
    const rel = `work/${id}/clip_${n}.mp4`;
    await setJob(id, {
      stage: "Render klip",
      detail: `Menyiapkan klip ${i + 1} dari ${clips.length}`,
    });
    await cutClip(videoPath, clip, path.join(ROOT, "public", rel));

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

    items.push({
      n,
      props: {
        src: rel,
        captions: clipCaptions,
        title: clip.title,
        durationInSeconds: clip.end - clip.start,
        layout: "cover", // latar sudah dibuat FFmpeg, Remotion hanya menambah judul dan caption
      },
    });
  }

  // 2. Bundle sekali (setelah segmen dibuat), lalu render semua klip
  await setJob(id, { stage: "Render klip", detail: "Menyiapkan render" });
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    publicDir: path.join(ROOT, "public"),
  });

  for (const [index, { n, props }] of items.entries()) {
    let lastPct = -1;
    const composition = await selectComposition({
      serveUrl,
      id: "Clip",
      inputProps: props,
    });
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
