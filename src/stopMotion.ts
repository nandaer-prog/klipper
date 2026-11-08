import { random } from "remotion";

/** Gerak stop-motion: frame dibulatkan ke bawah ke kelipatan 2 ("on twos"). Aman untuk frame negatif. */
export const onTwos = (f: number) => f - (((f % 2) + 2) % 2);

/** Sama seperti onTwos, tetapi kelipatan 3 ("on threes"). */
export const onThrees = (f: number) => f - (((f % 3) + 3) % 3);

/** Getar tangan halus (-1..1) yang berganti tiap 3 frame, tetap sama untuk seed dan ketukan yang sama. */
export const jitter = (seed: string, frame: number) => random(`${seed}-${Math.floor(frame / 3)}`) * 2 - 1;

/** Id elemen SVG yang aman dipakai di url(#...). */
export const svgId = (seed: string) => `c${seed.replace(/[^a-zA-Z0-9]/g, "")}`;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Tekstur bintik kertas (noise abu-abu) sebagai background-image CSS. */
export const PAPER_NOISE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.3'/></svg>")`;
