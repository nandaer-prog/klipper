import { mkdir, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { INBOX, VIDEO_EXT } from "./config";
import { processVideo } from "./pipeline";
import { clearStatus } from "./status";

const DONE = path.join(INBOX, "done");
const FAILED = path.join(INBOX, "failed");
await mkdir(DONE, { recursive: true });
await mkdir(FAILED, { recursive: true });
await clearStatus();

const lastSize = new Map<string, number>();
let busy = false;

const tick = async () => {
  if (busy) return;
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
    busy = true;
    lastSize.delete(file);
    try {
      await processVideo(file);
      await rename(file, path.join(DONE, path.basename(file)));
    } catch (e) {
      console.error(`Gagal memproses ${file}:`, e);
      const target = path.join(FAILED, path.basename(file));
      await rename(file, target);
      await writeFile(
        `${target}.txt`,
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      await clearStatus();
      busy = false;
    }
    break;
  }
};

console.log(`Memantau ${INBOX} ... (Ctrl+C untuk berhenti)`);
setInterval(() => void tick().catch(console.error), 5000);
