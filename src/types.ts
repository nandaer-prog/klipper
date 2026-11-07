import type { Caption } from "@remotion/captions";

export type ClipProps = {
  /** Path relatif terhadap folder public/, misal "work/video1/clip_01.mp4" */
  src: string;
  /** Caption dengan timestamp relatif terhadap awal klip */
  captions: Caption[];
  title: string;
  durationInSeconds: number;
  /** cover = crop tengah, blur-fit = video utuh di tengah + latar blur */
  layout: "cover" | "blur-fit";
};

export const defaultClipProps: ClipProps = {
  src: "",
  captions: [],
  title: "",
  durationInSeconds: 10,
  layout: "blur-fit",
};
