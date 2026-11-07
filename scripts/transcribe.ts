import type { Caption } from "@remotion/captions";
import {
  downloadWhisperModel,
  installWhisperCpp,
  toCaptions,
  transcribe,
} from "@remotion/install-whisper-cpp";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  WHISPER_DIR,
  WHISPER_BEAM,
  WHISPER_LANGUAGE,
  WHISPER_MODEL,
  WHISPER_THREADS,
  WHISPER_VERSION,
} from "./config";

/** Transkripsi video -> work/<id>/captions.json (timestamp relatif ke video asli). */
export const transcribeVideo = async (
  videoPath: string,
  workDir: string,
  onProgress?: (pct: number) => void,
): Promise<Caption[]> => {
  const captionsFile = path.join(workDir, "captions.json");
  if (existsSync(captionsFile)) {
    return JSON.parse(await readFile(captionsFile, "utf8")) as Caption[];
  }

  await mkdir(workDir, { recursive: true });
  const wav = path.join(workDir, "audio.wav");
  // whisper.cpp butuh WAV 16kHz mono
  execFileSync(
    "ffmpeg",
    ["-y", "-i", videoPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav],
    { stdio: "ignore" },
  );

  await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION });
  await downloadWhisperModel({ model: WHISPER_MODEL, folder: WHISPER_DIR });

  const output = await transcribe({
    inputPath: wav,
    whisperPath: WHISPER_DIR,
    whisperCppVersion: WHISPER_VERSION,
    model: WHISPER_MODEL,
    modelFolder: WHISPER_DIR,
    language: WHISPER_LANGUAGE,
    tokenLevelTimestamps: true,
    additionalArgs: ["-t", WHISPER_THREADS, "-bs", WHISPER_BEAM, "-bo", WHISPER_BEAM],
    onProgress: (p) => {
      const pct = Math.round(p * 100);
      process.stdout.write(`\rTranskripsi ${pct}%`);
      onProgress?.(pct);
    },
  });
  process.stdout.write("\n");

  const { captions } = toCaptions({ whisperCppOutput: output });
  await writeFile(captionsFile, JSON.stringify(captions, null, 2));
  return captions;
};
