import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

// Font Google dimuat saat render (butuh internet di mesin yang merender)
export const montserrat = loadMontserrat("normal", {
  weights: ["800", "900"],
  subsets: ["latin"],
}).fontFamily;

export const anton = loadAnton("normal", {
  weights: ["400"],
  subsets: ["latin"],
}).fontFamily;
