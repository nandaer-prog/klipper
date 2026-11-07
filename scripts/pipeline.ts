import { execFileSync } from "node:child_process";
import path from "node:path";
import { WORK } from "./config";
import { pickClips } from "./pick-clips";
import { renderClips } from "./render-clips";
import { setStatus } from "./status";
import { transcribeVideo } from "./transcribe";

const slug = (file: string) =>
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

export const processVideo = async (videoPath: string) => {
  const id = slug(videoPath);
  const workDir = path.join(WORK, id);
  console.log(`\n=== Memproses ${videoPath} (id: ${id}) ===`);

  await setStatus({ file: path.basename(videoPath), stage: "Transkripsi suara", detail: "" });
  const captions = await transcribeVideo(videoPath, workDir);
  console.log(`Transkrip: ${captions.length} kata`);

  await setStatus({ stage: "Claude memilih momen terbaik", detail: "" });
  const clips = await pickClips(captions, probeDuration(videoPath), workDir);
  console.log(`Claude memilih ${clips.length} klip:`);
  for (const c of clips) {
    console.log(`  ${c.start.toFixed(1)}-${c.end.toFixed(1)}s  ${c.title}`);
  }

  await renderClips(id, videoPath, clips, captions);
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
