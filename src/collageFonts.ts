import { loadFont as loadAbril } from "@remotion/google-fonts/AbrilFatface";
import { loadFont as loadArchivo } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadElite } from "@remotion/google-fonts/SpecialElite";

// Font tambahan untuk gaya kolase (huruf ransom, viewfinder). Dimuat dari Google Fonts saat render.
export const abril = loadAbril("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
export const archivo = loadArchivo("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
export const playfair = loadPlayfair("normal", { weights: ["900"], subsets: ["latin"] }).fontFamily;
export const elite = loadElite("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
