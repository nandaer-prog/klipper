import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { HEAVY_EXCLUSIVE, INBOX, VIDEO_EXT } from "./config";
import {
  makeJob,
  STAGE,
  stageClaude,
  stageRender,
  stageTranscribe,
  type Job,
} from "./pipeline";
import { takeSidecar } from "./settings";
import { clearJobs, removeJob, setJob } from "./status";

/**
 * Pipeline per tahap: Transkripsi -> Claude -> Render.
 * Tiap tahap memproses satu video sekaligus, tetapi tahap-tahap berjalan
 * bersamaan. Begitu video A pindah dari transkripsi ke Claude, video antre B
 * langsung mulai ditranskrip tanpa menunggu A selesai render.
 */
const DONE = path.join(INBOX, "done");
const FAILED = path.join(INBOX, "failed");
const PROCESSING = path.join(INBOX, "processing");
// Batas video yang sedang berjalan, supaya hasil transkrip tidak menumpuk
const MAX_INFLIGHT = Number(process.env.MAX_INFLIGHT ?? 3);
// Tahap berat menunggu sampai RAM bebas cukup (Linux saja)
const MIN_FREE_MB = Number(process.env.MIN_FREE_MB ?? 900);

await mkdir(DONE, { recursive: true });
await mkdir(FAILED, { recursive: true });
await mkdir(PROCESSING, { recursive: true });
await clearJobs();

// Pulihkan video yang tertinggal di folder processing setelah restart
for (const f of await readdir(PROCESSING)) {
  await rename(path.join(PROCESSING, f), path.join(INBOX, f));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Mode uji kering: tahap diganti jeda waktu (untuk menguji antrean tanpa Whisper/Claude/render)
const dry = process.env.PIPELINE_DRYRUN === "1";
const fakeStage = (stage: string) => async (j: Job) => {
  await setJob(j.id, { file: path.basename(j.videoPath), stage, detail: "" });
  console.log(`${new Date().toISOString().slice(14, 19)} ${j.id}: ${stage}`);
  await sleep(Number(process.env.DRYRUN_MS ?? 4000));
};
const run = {
  transcribe: dry ? fakeStage(STAGE.transcribe) : stageTranscribe,
  claude: dry ? fakeStage(STAGE.claude) : stageClaude,
  render: dry ? fakeStage(STAGE.render) : stageRender,
};

const memAvailableMB = async () => {
  try {
    const t = await readFile("/proc/meminfo", "utf8");
    const m = /MemAvailable:\s+(\d+) kB/.exec(t);
    return m ? Number(m[1]) / 1024 : Infinity;
  } catch {
    return Infinity;
  }
};
const waitMemory = async (j: Job) => {
  let waited = false;
  while ((await memAvailableMB()) < MIN_FREE_MB) {
    waited = true;
    await setJob(j.id, { detail: "Menunggu memori bebas" });
    await sleep(3000);
  }
  if (waited) await setJob(j.id, { detail: "" });
};

// Kunci tahap berat: transkripsi dan render bergantian agar tidak berebut RAM
let heavyChain: Promise<void> = Promise.resolve();
const withHeavy = async <T>(j: Job, task: () => Promise<T>): Promise<T> => {
  if (!HEAVY_EXCLUSIVE) return task();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  const prev = heavyChain;
  heavyChain = prev.then(() => mine);
  await setJob(j.id, { detail: "Menunggu giliran CPU" });
  await prev;
  await setJob(j.id, { detail: "" });
  try {
    return await task();
  } finally {
    release();
  }
};

const inflight = new Set<Job>();
const queues = { claude: [] as Job[], render: [] as Job[] };
const busy = { transcribe: false, claude: false, render: false };

const fail = async (j: Job, e: unknown) => {
  console.error(`[${j.id}] gagal:`, e);
  const target = path.join(FAILED, path.basename(j.videoPath));
  try {
    await rename(j.videoPath, target);
    await writeFile(`${target}.txt`, e instanceof Error ? e.message : String(e));
  } catch (err) {
    console.error("Tidak bisa memindahkan file gagal:", err);
  }
  inflight.delete(j);
  await removeJob(j.id);
};

const finish = async (j: Job) => {
  await rename(j.videoPath, path.join(DONE, path.basename(j.videoPath)));
  inflight.delete(j);
  await removeJob(j.id);
  console.log(`[${j.id}] selesai`);
};

const runRender = async () => {
  if (busy.render) return;
  const j = queues.render.shift();
  if (!j) return;
  busy.render = true;
  try {
    await withHeavy(j, async () => {
      await waitMemory(j);
      await run.render(j);
    });
    await finish(j);
  } catch (e) {
    await fail(j, e);
  } finally {
    busy.render = false;
    void runRender();
  }
};

const runClaude = async () => {
  if (busy.claude) return;
  const j = queues.claude.shift();
  if (!j) return;
  busy.claude = true;
  try {
    await run.claude(j);
    queues.render.push(j);
    await setJob(j.id, { stage: STAGE.waitRender, detail: "" });
    void runRender();
  } catch (e) {
    await fail(j, e);
  } finally {
    busy.claude = false;
    void runClaude();
  }
};

const lastSize = new Map<string, number>();

const tick = async () => {
  if (busy.transcribe || inflight.size >= MAX_INFLIGHT) return;

  const files = (await readdir(INBOX, { withFileTypes: true }))
    .filter(
      (d) =>
        d.isFile() && VIDEO_EXT.includes(path.extname(d.name).toLowerCase()),
    )
    .map((d) => path.join(INBOX, d.name));

  for (const file of files) {
    const size = (await stat(file)).size;
    // Tunggu sampai ukuran file stabil (selesai disalin dari desktop)
    if (lastSize.get(file) !== size) {
      lastSize.set(file, size);
      continue;
    }
    lastSize.delete(file);

    const moved = path.join(PROCESSING, path.basename(file));
    const settings = await takeSidecar(file);
    await rename(file, moved);
    const j = makeJob(moved, settings);
    inflight.add(j);
    busy.transcribe = true;
    console.log(`\n=== ${j.id}: mulai transkripsi ===`);
    void (async () => {
      try {
        await setJob(j.id, { file: path.basename(moved), stage: STAGE.transcribe, detail: "" });
        await withHeavy(j, async () => {
          await waitMemory(j);
          await run.transcribe(j);
        });
        queues.claude.push(j);
        await setJob(j.id, { stage: STAGE.waitClaude, detail: "" });
        void runClaude();
      } catch (e) {
        await fail(j, e);
      } finally {
        busy.transcribe = false;
      }
    })();
    break;
  }
};

console.log(`Memantau ${INBOX} ... (Ctrl+C untuk berhenti)`);
setInterval(() => void tick().catch(console.error), 5000);
