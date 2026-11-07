import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BRollItem } from "../src/types";

/**
 * Footage B-roll dari Pixabay (butuh PIXABAY_API_KEY di .env.local).
 * Hasil pencarian di-cache 24 jam (syarat Pixabay) dan video diunduh ke lokal.
 * Tanpa kunci atau jika gagal, item tetap tampil sebagai animasi biasa.
 */

type PixabayVideo = { url: string; width: number; height: number; size: number };
type PixabayHit = { id: number; duration: number; videos: Record<"large" | "medium" | "small" | "tiny", PixabayVideo> };

const DAY = 24 * 3600 * 1000;

const searchVideos = async (query: string, key: string, cacheDir: string): Promise<PixabayHit[]> => {
  const cacheFile = path.join(cacheDir, `search_${Buffer.from(query).toString("hex").slice(0, 60)}.json`);
  if (existsSync(cacheFile) && Date.now() - (await stat(cacheFile)).mtimeMs < DAY) {
    return JSON.parse(await readFile(cacheFile, "utf8")) as PixabayHit[];
  }
  const url = new URL("https://pixabay.com/api/videos/");
  url.searchParams.set("key", key);
  url.searchParams.set("q", query.slice(0, 100));
  url.searchParams.set("lang", "id");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", "20");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay ${res.status}`);
  const hits = ((await res.json()) as { hits: PixabayHit[] }).hits;
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(hits));
  return hits;
};

/** Ganti item `scene` dan `keyword` dengan footage Pixabay bila ada; path `footage` relatif terhadap public/. */
export const attachFootage = async (
  items: BRollItem[],
  opts: { publicDir: string; relDir: string; prefix: string },
): Promise<BRollItem[]> => {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return items;
  const dir = path.join(opts.publicDir, opts.relDir);
  const out: BRollItem[] = [];
  for (const [i, item] of items.entries()) {
    // keyword hanya dijadikan footage bila FOOTAGE_KEYWORD=1 (hasil pencarian kata lepas bisa tidak relevan)
    const eligible = item.type === "scene" || (item.type === "keyword" && process.env.FOOTAGE_KEYWORD === "1");
    if (!eligible) {
      out.push(item);
      continue;
    }
    try {
      const hits = await searchVideos(item.sub ? `${item.text} ${item.sub}` : item.text, key, dir);
      // utamakan video yang cukup panjang untuk durasi cutaway
      const hit = hits.find((h) => h.duration >= item.dur && h.videos.medium?.url) ?? hits.find((h) => h.videos.medium?.url);
      if (!hit) {
        out.push(item);
        continue;
      }
      const file = `${opts.prefix}_${i}.mp4`;
      const res = await fetch(hit.videos.medium.url);
      if (!res.ok) throw new Error(`unduh ${res.status}`);
      await writeFile(path.join(dir, file), Buffer.from(await res.arrayBuffer()));
      // keyword yang dapat footage menjadi cutaway `scene`
      out.push({ ...item, type: "scene", footage: `${opts.relDir}/${file}` });
    } catch (e) {
      console.warn(`Footage dilewati untuk "${item.text}": ${(e as Error).message}`);
      out.push(item);
    }
  }
  return out;
};
