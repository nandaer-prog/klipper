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
        prev.text += c.text.trim().replace(/[-–—]+/g, ""); // strip dialog tidak ikut digabung
        prev.endMs = Math.max(prev.endMs, c.endMs);
      }
      continue;
    }
    // buang tanda strip sisa penanda dialog Whisper ("ko.-", "-Iya")
    const text = c.text.replace(/^(\s*)[-–—]+\s*/, "$1").replace(/\s*[-–—]+$/, "");
    if (text.trim() === "") continue;
    out.push({ ...c, text });
  }
  return out;
};
