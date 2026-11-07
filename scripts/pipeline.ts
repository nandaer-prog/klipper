import type { Caption } from "@remotion/captions";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { WORK } from "./config";
import { pickClips, type ClipPlan } from "./pick-clips";
import { renderClips } from "./render-clips";
import { removeJob, setJob } from "./status";
import { transcribeVideo } from "./transcribe";

export const slug = (file: string) =>
  path.basename(file, path.extname(file)).replace(/[^a-zA-Z0-9_-]+/g, "_");

const probeDuration = (file: string) =>
  Number(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=nw=1:nk=1",
      file,
    ]).toString(),
  );

export const STAGE = {
  transcribe: "Transkripsi suara",
  waitClaude: "Antre Claude",
  claude: "Claude memilih momen terbaik",
  waitRender: "Antre render",
  render: "Render klip",
} as const;

export type Job = {
  id: string;
  videoPath: string;
  workDir: string;
  captions?: Caption[];
  clips?: ClipPlan[];
};

export const makeJob = (videoPath: string): Job => {
  const id = slug(videoPath);
  return { id, videoPath, workDir: path.join(WORK, id) };
};

export const stageTranscribe = async (j: Job) => {
  await setJob(j.id, { file: path.basename(j.videoPath), stage: STAGE.transcribe, detail: "" });
  let last = -1;
  j.captions = await transcribeVideo(j.videoPath, j.workDir, (pct) => {
    if (pct !== last) {
      last = pct;
      void setJob(j.id, { detail: `${pct}%` });
    }
  });
  console.log(`[${j.id}] transkrip: ${j.captions.length} kata`);
};

export const stageClaude = async (j: Job) => {
  await setJob(j.id, { stage: STAGE.claude, detail: "" });
  if (!j.captions) throw new Error("Transkrip belum ada");
  j.clips = await pickClips(j.captions, probeDuration(j.videoPath), j.workDir);
  console.log(`[${j.id}] Claude memilih ${j.clips.length} klip:`);
  for (const c of j.clips) {
    console.log(`  ${c.start.toFixed(1)}-${c.end.toFixed(1)}s  ${c.title}`);
  }
};

export const stageRender = async (j: Job) => {
  await setJob(j.id, { stage: STAGE.render, detail: "" });
  if (!j.captions || !j.clips) throw new Error("Transkrip atau daftar klip belum ada");
  await renderClips(j.id, j.videoPath, j.clips, j.captions);
};

/** Jalankan semua tahap berurutan untuk satu video (dipakai oleh `npm run clip`). */
export const processVideo = async (videoPath: string) => {
  const j = makeJob(videoPath);
  console.log(`\n=== Memproses ${videoPath} (id: ${j.id}) ===`);
  try {
    await stageTranscribe(j);
    await stageClaude(j);
    await stageRender(j);
  } finally {
    await removeJob(j.id);
  }
};

// Jalankan manual: npm run clip -- inbox/video.mp4
if (import.meta.filename === path.resolve(process.argv[1] ?? "")) {
  const file = process.argv[2];
  if (!file) {
    console.error("Pemakaian: npm run clip -- <path-video>");
    process.exit(1);
  }
  await processVideo(path.resolve(file));
}
