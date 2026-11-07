import type { Caption } from "@remotion/captions";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { ClipProps } from "../src/types";
import { LAYOUT, OUTPUT, ROOT } from "./config";
import type { ClipPlan } from "./pick-clips";
import { setStatus } from "./status";

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

  // 1. Potong segmen dengan FFmpeg (re-encode agar presisi di frame)
  const items = clips.map((clip, i) => {
    const n = String(i + 1).padStart(2, "0");
    const rel = `work/${id}/clip_${n}.mp4`;
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(clip.start),
        "-to",
        String(clip.end),
        "-i",
        videoPath,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        path.join(ROOT, "public", rel),
      ],
      { stdio: "ignore" },
    );

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

    const props: ClipProps = {
      src: rel,
      captions: clipCaptions,
      title: clip.title,
      durationInSeconds: clip.end - clip.start,
      layout: LAYOUT,
    };
    return { n, props };
  });

  // 2. Bundle sekali (setelah segmen dibuat), lalu render semua klip
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
      onProgress: ({ progress }) => {
        const pct = Math.round(progress * 100);
        process.stdout.write(`\rRender klip ${n}: ${pct}%`);
        if (pct !== lastPct) {
          lastPct = pct;
          void setStatus({
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
