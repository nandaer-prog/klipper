import type { Caption } from "@remotion/captions";

const PUNCT_ONLY = /^[\s.,!?;:…\-–—"'()[\]]+$/;

/**
 * Rapikan hasil Whisper: token yang hanya berisi tanda baca digabung ke kata di
 * depannya (atau dibuang jika tidak ada), sehingga caption tidak menampilkan ",," sendirian.
 */
export const sanitizeCaptions = (captions: Caption[]): Caption[] => {
  const out: Caption[] = [];
  for (const c of captions) {
    if (c.text.trim() === "") continue;
    if (PUNCT_ONLY.test(c.text)) {
      const prev = out[out.length - 1];
      if (prev) {
        prev.text += c.text.trim();
        prev.endMs = Math.max(prev.endMs, c.endMs);
      }
      continue;
    }
    out.push({ ...c });
  }
  return out;
};
