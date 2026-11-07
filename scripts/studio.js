/* eslint-disable @remotion/deterministic-randomness -- kode browser, bukan komposisi Remotion */
/* global document, window, requestAnimationFrame, performance, matchMedia, setInterval */
// Studio pixel-art untuk dashboard Clipper: karakter berjalan antar meja sesuai tahap pipeline.
// Semua gambar dibuat lewat kode (tanpa aset eksternal).
(() => {
const W = 480;
const H = 270;
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const short = (s, n = 30) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const speedFactor = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.4 : 1;

const cv = $("floor");
cv.width = W;
cv.height = H;
const ctx = cv.getContext("2d");
const layer = () => {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return c;
};
const bgC = layer();
const fgC = layer();

const R = (c, x, y, w, h, col) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), w, h);
};
const mk = (seed) => {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
};
const OL = "#2b1d14";

// ---------- Perabot ----------
const desk = (c, x, y, w, h = 14) => {
  R(c, x - 1, y - 1, w + 2, h + 9, OL);
  R(c, x, y, w, h, "#dca56a");
  R(c, x, y, w, 1, "#efc68f");
  R(c, x, y + h, w, 7, "#9d6b3a");
  R(c, x, y + h + 5, w, 2, "#7a5128");
  R(c, x + 3, y + h + 1, 10, 5, "#86592d");
  R(c, x + w - 13, y + h + 1, 10, 5, "#86592d");
};
const monitor = (c, x, y, w = 14, h = 10) => {
  R(c, x - 1, y - 1, w + 2, h + 3, "#1f2433");
  R(c, x, y, w, h, "#16213e");
  R(c, x + w / 2 - 1, y + h + 2, 2, 2, "#555");
  R(c, x + w / 2 - 4, y + h + 4, 8, 1, "#444");
};
const keyboard = (c, x, y) => {
  R(c, x, y, 12, 4, "#2a2f3a");
  R(c, x + 1, y + 1, 10, 1, "#555b6b");
  R(c, x + 1, y + 3, 10, 1, "#555b6b");
};
const chair = (c, x, y, col, dark) => {
  R(c, x - 1, y - 1, 12, 10, OL);
  R(c, x, y, 10, 8, dark);
  R(c, x - 1, y + 8, 12, 6, OL);
  R(c, x, y + 8, 10, 4, col);
  R(c, x + 4, y + 14, 2, 3, "#333");
  R(c, x, y + 17, 10, 1, "#333");
};
const stool = (c, x, y, col) => {
  R(c, x - 1, y - 1, 10, 6, OL);
  R(c, x, y, 8, 4, col);
  R(c, x + 1, y + 5, 1, 4, "#444");
  R(c, x + 6, y + 5, 1, 4, "#444");
};
const plant = (c, x, y, s, seed) => {
  const r = mk(seed);
  const greens = ["#2f7d3c", "#3f9b4b", "#5cb85c", "#276a33"];
  R(c, x - 5 * s, y - 6 * s, 10 * s, 6 * s, OL);
  R(c, x - 4 * s, y - 5 * s, 8 * s, 5 * s, "#a55e30");
  R(c, x - 4 * s, y - 5 * s, 8 * s, 1 * s, "#c9803f");
  for (let i = 0; i < 16; i++) {
    const lx = x + (r() * 16 - 8) * s;
    const ly = y - 8 * s - r() * 16 * s;
    R(c, lx, ly, 5 * s, 4 * s, greens[Math.floor(r() * 4)]);
  }
};
const carpet = (c, x, y, w, h, base, accent) => {
  R(c, x, y, w, h, base);
  R(c, x, y, w, 3, accent);
  R(c, x, y + h - 3, w, 3, accent);
  R(c, x, y, 3, h, accent);
  R(c, x + w - 3, y, 3, h, accent);
  for (let i = 8; i < w - 8; i += 10) R(c, x + i, y + 6, 4, h - 12, accent === base ? base : "rgba(255,255,255,.1)");
};
const sofa = (c, x, y, w) => {
  R(c, x - 4, y - 1, w + 8, 24, OL);
  R(c, x, y, w, 10, "#1f5d3a");
  R(c, x, y + 10, w, 10, "#2b7a4c");
  R(c, x - 3, y + 4, 5, 16, "#1f5d3a");
  R(c, x + w - 2, y + 4, 5, 16, "#1f5d3a");
  R(c, x + 6, y + 3, 9, 8, "#f2b705");
  R(c, x + w - 18, y + 3, 9, 8, "#e8452c");
};
const shelf = (c, x, y, w, h, seed) => {
  const r = mk(seed);
  R(c, x - 1, y - 1, w + 2, h + 2, OL);
  R(c, x, y, w, h, "#7a4f2b");
  const cols = ["#d94f4f", "#4f7bd9", "#e6b422", "#4fb36b", "#8e5bd0", "#ddd"];
  for (let sy = y + 2; sy < y + h - 8; sy += 14) {
    R(c, x, sy + 11, w, 2, "#a8723c");
    for (let bx = x + 2; bx < x + w - 3; bx += 3) {
      const bh = 6 + Math.floor(r() * 5);
      R(c, bx, sy + 11 - bh, 2, bh, cols[Math.floor(r() * cols.length)]);
    }
  }
};
const board = (c, x, y, w, h, seed, notes = true) => {
  const r = mk(seed);
  R(c, x - 2, y - 2, w + 4, h + 4, "#9aa3b2");
  R(c, x, y, w, h, "#fbfbf5");
  if (notes) {
    const cols = ["#ffd166", "#ef8fa3", "#7fd1ae", "#8ecbff", "#f4a259"];
    for (let i = 0; i < 12; i++) R(c, x + 3 + r() * (w - 14), y + 3 + r() * (h - 12), 7, 6, cols[Math.floor(r() * cols.length)]);
  }
};
const swatches = (c, x, y, w, h, seed) => {
  const r = mk(seed);
  R(c, x - 2, y - 2, w + 4, h + 4, "#3a3a4a");
  const cols = ["#e8452c", "#2f5bd3", "#f2b705", "#2fa564", "#7b4bd6", "#e060a0", "#1f2a4d", "#f4a259"];
  for (let yy = y; yy < y + h; yy += 8)
    for (let xx = x; xx < x + w; xx += 8) R(c, xx, yy, 8, 8, cols[Math.floor(r() * cols.length)]);
};
const win = (c, x, y, w, h, seed, cols = 2) => {
  const r = mk(seed);
  R(c, x - 2, y - 2, w + 4, h + 4, "#2b3a67");
  R(c, x, y, w, h, "#9fd3ff");
  R(c, x, y, w, Math.floor(h * 0.45), "#bfe3ff");
  for (let i = 0; i < 3; i++) R(c, x + r() * (w - 16), y + 3 + r() * 8, 14, 4, "#fff");
  let bx = x;
  while (bx < x + w) {
    const bw = 6 + Math.floor(r() * 8);
    const bh = 10 + Math.floor(r() * h * 0.55);
    const col = ["#6f86a8", "#5b7194", "#8aa1c0", "#4f6488"][Math.floor(r() * 4)];
    const ww = Math.min(bw, x + w - bx);
    R(c, bx, y + h - bh, ww, bh, col);
    for (let wy = y + h - bh + 2; wy < y + h - 2; wy += 4)
      for (let wx = bx + 1; wx < bx + ww - 1; wx += 3) if (r() > 0.55) R(c, wx, wy, 1, 2, "#e9f4ff");
    bx += bw;
  }
  for (let k = 1; k < cols; k++) R(c, x + Math.floor((k * w) / cols) - 1, y, 2, h, "#ece6d8");
  R(c, x, y + Math.floor(h / 2) - 1, w, 2, "#ece6d8");
};
const tripod = (c, x, y) => {
  for (let i = 0; i < 14; i++) {
    R(c, x - 1 - Math.floor(i / 3), y + i, 1, 1, "#333");
    R(c, x + 1 + Math.floor(i / 3), y + i, 1, 1, "#333");
  }
  R(c, x, y - 2, 1, 16, "#333");
  R(c, x - 8, y - 12, 16, 10, "#222");
  R(c, x - 7, y - 11, 14, 2, "#3b3b3b");
  R(c, x + 8, y - 10, 5, 6, "#5b7fb8");
};
const cabinet = (c, x, y) => {
  R(c, x - 1, y - 1, 20, 28, OL);
  R(c, x, y, 18, 26, "#cfd3da");
  R(c, x, y + 8, 18, 1, "#9aa0ab");
  R(c, x, y + 17, 18, 1, "#9aa0ab");
  R(c, x + 6, y + 4, 6, 1, "#666");
  R(c, x + 6, y + 13, 6, 1, "#666");
  R(c, x + 6, y + 21, 6, 1, "#666");
};
const printer = (c, x, y) => {
  R(c, x - 1, y - 1, 26, 18, OL);
  R(c, x, y, 24, 16, "#c9ced6");
  R(c, x + 3, y + 3, 18, 3, "#555");
  R(c, x + 4, y + 10, 16, 2, "#f6f6f0");
};
const coffeeBar = (c, x, y, w) => {
  R(c, x - 1, y - 1, w + 2, 33, OL);
  R(c, x, y, w, 8, "#efe6cd");
  R(c, x, y + 8, w, 22, "#23407a");
  R(c, x, y + 8, w, 2, "#1a3160");
  R(c, x + 8, y - 12, 12, 12, "#4a4a55");
  R(c, x + 10, y - 9, 8, 4, "#9aa");
  R(c, x + 12, y - 3, 4, 3, "#c33");
  for (let i = 0; i < 3; i++) R(c, x + 30 + i * 8, y - 4, 5, 4, "#f6f0e0");
  R(c, x + w - 18, y - 6, 12, 6, "#b07a45");
};

// ---------- Latar statis ----------
const drawBackground = (c) => {
  // lantai kayu
  R(c, 0, 56, W, H - 56, "#c98f4e");
  for (let y = 56; y < H; y += 9) {
    R(c, 0, y, W, 1, "#b5793a");
    for (let x = (y * 7) % 47; x < W; x += 47) R(c, x, y, 1, 9, "#b5793a");
  }
  c.globalAlpha = 0.2;
  c.fillStyle = "#fff0c0";
  c.beginPath();
  c.moveTo(176, 58);
  c.lineTo(300, 58);
  c.lineTo(350, 150);
  c.lineTo(210, 150);
  c.closePath();
  c.fill();
  c.globalAlpha = 1;

  // dinding bata
  R(c, 0, 0, W, 56, "#ebe5d6");
  for (let y = 0, row = 0; y < 52; y += 7, row++) {
    R(c, 0, y + 6, W, 1, "#cfc6b3");
    for (let x = row % 2 ? 7 : 0; x < W; x += 14) R(c, x, y, 1, 6, "#cfc6b3");
  }
  R(c, 0, 52, W, 4, "#a89a82");
  R(c, 0, 56, W, 2, "#7d6a4f");

  // jendela dan dekorasi dinding
  win(c, 178, 8, 124, 38, 11, 4);
  win(c, 8, 10, 30, 34, 5, 2);
  win(c, 444, 10, 28, 34, 7, 2);
  board(c, 62, 10, 54, 32, 3);
  swatches(c, 356, 12, 48, 30, 9);
  shelf(c, 128, 12, 38, 38, 21);
  shelf(c, 30, 62, 20, 34, 4);
  R(c, 8, 54, 14, 34, "#2f5bd3"); // pintu
  R(c, 8, 54, 14, 2, OL);
  R(c, 18, 70, 2, 3, "#f2b705");

  // karpet
  carpet(c, 46, 76, 94, 46, "#38539a", "#27407a"); // strategi
  carpet(c, 14, 134, 88, 52, "#c8662f", "#a04e1f"); // lounge
  carpet(c, 34, 186, 116, 62, "#b53a2e", "#8a2a20"); // client review

  // strategi (dekor)
  desk(c, 58, 88, 72, 14);
  R(c, 70, 84, 14, 5, "#f6f6f0");
  R(c, 100, 85, 10, 4, "#f2b705");
  chair(c, 68, 108, "#2f5bd3", "#24459f");
  chair(c, 104, 108, "#2f5bd3", "#24459f");
  board(c, 28, 62, 22, 28, 15);

  // lounge
  sofa(c, 24, 142, 60);
  R(c, 36, 164, 32, 14, OL);
  R(c, 37, 165, 30, 12, "#a97a45");
  R(c, 44, 166, 6, 4, "#f6f0e0");
  R(c, 54, 168, 6, 4, "#f6f0e0");
  R(c, 80, 168, 14, 12, OL);
  R(c, 81, 169, 12, 10, "#e8742f");
  printer(c, 6, 118);

  // client review
  desk(c, 52, 202, 82, 16);
  R(c, 62, 198, 12, 5, "#f6f6f0");
  R(c, 90, 198, 10, 5, "#f6f6f0");
  R(c, 82, 195, 14, 8, "#2a2f3a");
  [60, 86, 112].forEach((cx) => chair(c, cx, 184, "#e8742f", "#c25a1d"));

  // studio hub (tengah)
  desk(c, 192, 140, 70, 20);
  R(c, 200, 137, 10, 4, "#f6f6f0");
  R(c, 240, 138, 12, 4, "#f6f6f0");
  R(c, 222, 144, 12, 6, "#dfe6f2");
  R(c, 214, 148, 4, 4, "#f6f0e0");
  stool(c, 186, 148, "#f2b705");
  stool(c, 266, 148, "#2f5bd3");
  stool(c, 204, 170, "#f2b705");
  stool(c, 248, 170, "#2f5bd3");
  plant(c, 227, 141, 1, 77);

  // creative
  desk(c, 248, 74, 92, 14);
  monitor(c, 258, 62, 17, 11);
  monitor(c, 280, 62, 17, 11);
  monitor(c, 302, 62, 17, 11);
  keyboard(c, 262, 78);
  keyboard(c, 286, 78);
  R(c, 326, 76, 8, 6, "#f6f6f0");
  chair(c, 288, 96, "#2f5bd3", "#24459f");
  R(c, 346, 82, 24, 28, OL);
  swatches(c, 348, 84, 20, 20, 33);
  R(c, 356, 106, 4, 14, "#6b4a2a");

  // production
  R(c, 380, 94, 4, 62, "#e8e8e8");
  R(c, 380, 94, 4, 2, "#9aa0ab");
  desk(c, 392, 120, 60, 14);
  monitor(c, 404, 104, 28, 16);
  monitor(c, 436, 108, 12, 9);
  keyboard(c, 410, 124);
  R(c, 440, 104, 10, 14, "#2a2f3a");
  tripod(c, 352, 140);
  chair(c, 418, 144, "#7b4bd6", "#5d36a8");
  cabinet(c, 440, 62);

  // media lab
  desk(c, 330, 198, 122, 14);
  [338, 358, 378, 398, 418].forEach((mx) => monitor(c, mx, 186, 15, 10));
  [340, 380, 420].forEach((kx) => keyboard(c, kx, 202));
  [346, 386, 426].forEach((cx) => chair(c, cx, 218, "#2f5bd3", "#24459f"));
  shelf(c, 458, 168, 16, 50, 51);

  // coffee bar
  coffeeBar(c, 196, 214, 66);

  // tanaman
  plant(c, 24, 62, 2, 1);
  plant(c, 162, 100, 1, 2);
  plant(c, 346, 66, 1, 3);
  plant(c, 462, 74, 2, 4);
  plant(c, 22, 244, 2, 5);
  plant(c, 158, 156, 1, 6);
  plant(c, 280, 250, 2, 7);
  plant(c, 468, 150, 2, 8);

  // dekor lantai
  R(c, 290, 130, 18, 4, "rgba(0,0,0,.08)");
};
drawBackground(bgC.getContext("2d"));

// lapisan depan (menutupi karakter)
{
  const c = fgC.getContext("2d");
  R(c, 128, 252, 74, 18, OL);
  R(c, 130, 254, 70, 16, "#4a5d3a");
  R(c, 130, 254, 70, 3, "#6b8a52");
  R(c, 290, 254, 52, 16, OL);
  R(c, 292, 256, 48, 14, "#4a5d3a");
  R(c, 292, 256, 48, 3, "#6b8a52");
  const r = mk(99);
  const greens = ["#2f7d3c", "#3f9b4b", "#5cb85c", "#276a33"];
  for (let i = 0; i < 26; i++) R(c, 130 + r() * 66, 244 + r() * 12, 6, 5, greens[Math.floor(r() * 4)]);
  for (let i = 0; i < 18; i++) R(c, 292 + r() * 44, 246 + r() * 12, 6, 5, greens[Math.floor(r() * 4)]);
  plant(c, 12, 270, 3, 12);
  R(c, 222, 262, 36, 8, "#1c2236");
}

// ---------- Peta jalan ----------
const NODES = {
  n0: [160, 128],
  n1: [225, 122],
  n2: [296, 124],
  n3: [372, 166],
  n4: [300, 186],
  n5: [170, 196],
  n6: [160, 164],
  n8: [318, 238],
  n9: [140, 246],
};
const EDGES = [
  ["n0", "n1"], ["n1", "n2"], ["n2", "n3"], ["n2", "n4"], ["n3", "n4"],
  ["n4", "n5"], ["n5", "n6"], ["n6", "n0"], ["n4", "n8"], ["n5", "n9"],
];
const ADJ = {};
EDGES.forEach(([a, b]) => {
  const d = Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1]);
  (ADJ[a] ??= []).push([b, d]);
  (ADJ[b] ??= []).push([a, d]);
});
const nearestNode = (x, y) =>
  Object.keys(NODES).reduce(
    (best, k) => (Math.hypot(NODES[k][0] - x, NODES[k][1] - y) < Math.hypot(NODES[best][0] - x, NODES[best][1] - y) ? k : best),
    "n0",
  );
const dijkstra = (a, b) => {
  const dist = {};
  const prev = {};
  const todo = new Set(Object.keys(NODES));
  todo.forEach((k) => (dist[k] = Infinity));
  dist[a] = 0;
  while (todo.size) {
    let u = null;
    todo.forEach((k) => {
      if (u === null || dist[k] < dist[u]) u = k;
    });
    todo.delete(u);
    if (u === b) break;
    (ADJ[u] || []).forEach(([v, d]) => {
      if (dist[u] + d < dist[v]) {
        dist[v] = dist[u] + d;
        prev[v] = u;
      }
    });
  }
  const out = [];
  for (let k = b; k; k = prev[k]) out.unshift(k);
  return out;
};
const route = (x, y, to) => {
  const a = nearestNode(x, y);
  const b = to.via || nearestNode(to.x, to.y);
  const pts = dijkstra(a, b).map((n) => ({ x: NODES[n][0], y: NODES[n][1] }));
  pts.push({ x: to.x, y: to.y });
  return pts;
};

// ---------- Stasiun, titik santai, agen ----------
const STATIONS = [
  { name: "STUDIO HUB", sub: "Antrean & Unduh", seat: { x: 227, y: 180, via: "n5" }, card: { x: 227, y: 146 }, sign: [227, 134], screens: [[222, 145, 10, 6]] },
  { name: "MEDIA LAB", sub: "Transkripsi", seat: { x: 392, y: 236, via: "n8" }, card: { x: 392, y: 205 }, sign: [392, 178], screens: [[338, 186, 15, 10], [358, 186, 15, 10], [378, 186, 15, 10], [398, 186, 15, 10], [418, 186, 15, 10]] },
  { name: "CREATIVE", sub: "Claude Editor", seat: { x: 292, y: 112, via: "n2" }, card: { x: 292, y: 84 }, sign: [292, 58], screens: [[258, 62, 17, 11], [280, 62, 17, 11], [302, 62, 17, 11]] },
  { name: "PRODUCTION", sub: "Render", seat: { x: 424, y: 158, via: "n3" }, card: { x: 424, y: 128 }, sign: [424, 100], screens: [[404, 104, 28, 16], [436, 108, 12, 9]] },
  { name: "CLIENT REVIEW", sub: "Hasil Klip", seat: { x: 94, y: 240, via: "n9" }, card: { x: 94, y: 212 }, sign: [92, 196], screens: [[82, 195, 14, 8]] },
];
const SPOTS = {
  lounge: { x: 106, y: 166, via: "n6" },
  coffee: { x: 232, y: 208, via: "n5" },
  side: { x: 176, y: 186, via: "n5" },
  window: { x: 225, y: 104, via: "n1" },
  pitch: { x: 134, y: 114, via: "n0" },
};
const DEFS = [
  { name: "Aoi", role: "Koordinator Unduhan", station: 0, shirt: "#2f5bd3", hair: "#2b2b3a", skin: "#f2c9a5", glasses: true },
  { name: "Sora", role: "Juru Transkripsi", station: 1, shirt: "#f2b705", hair: "#5a3825", skin: "#e8b98f" },
  { name: "Ren", role: "Editor Claude", station: 2, shirt: "#e8452c", hair: "#1e1e1e", skin: "#f2c9a5" },
  { name: "Kai", role: "Operator Render", station: 3, shirt: "#7b4bd6", hair: "#c7c7d1", skin: "#d9a67a", glasses: true },
  { name: "Miu", role: "Penjaga Hasil", station: 4, shirt: "#e060a0", hair: "#6b3a2a", skin: "#f2c9a5" },
  { name: "Hina", role: "Asisten Studio", station: -1, shirt: "#2fa564", hair: "#8a5a2b", skin: "#f2c9a5" },
];

const agents = DEFS.map((d, i) => {
  const home = d.station >= 0 ? STATIONS[d.station].seat : SPOTS.lounge;
  return {
    ...d,
    i,
    x: home.x,
    y: home.y,
    dir: 1,
    path: [],
    t: Math.random() * 10,
    idle: 1 + Math.random() * 4,
    wantWork: false,
    working: false,
  };
});

const goTo = (a, target) => {
  a.path = route(a.x, a.y, target);
};
const pickIdle = (a) => {
  const spots = Object.values(SPOTS);
  if (a.station >= 0) spots.push(STATIONS[a.station].seat);
  const far = spots.filter((s) => Math.hypot(s.x - a.x, s.y - a.y) > 24);
  goTo(a, far[Math.floor(Math.random() * far.length)]);
};

const stepAgent = (a, dt, activeStation) => {
  const want = a.station >= 0 && a.station === activeStation;
  if (want && !a.wantWork) {
    a.wantWork = true;
    goTo(a, STATIONS[a.station].seat);
  }
  if (!want && a.wantWork) {
    a.wantWork = false;
    a.idle = 1.2;
  }
  a.working = want && a.path.length === 0;

  if (!want && a.path.length === 0) {
    a.idle -= dt;
    if (a.idle <= 0) {
      pickIdle(a);
      a.idle = 5 + Math.random() * 8;
    }
  }

  a.t += dt;
  a.walking = a.path.length > 0;
  if (a.walking) {
    const p = a.path[0];
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const d = Math.hypot(dx, dy);
    const sp = 34 * speedFactor * dt;
    if (d <= sp) {
      a.x = p.x;
      a.y = p.y;
      a.path.shift();
    } else {
      a.x += (dx / d) * sp;
      a.y += (dy / d) * sp;
      if (Math.abs(dx) > 0.4) a.dir = dx > 0 ? 1 : -1;
    }
  }
};

// ---------- Gambar karakter ----------
const INK = "#1b1b2f";
const drawAgent = (c, a) => {
  const x = Math.round(a.x);
  const y = Math.round(a.y);
  const f = a.walking ? Math.floor(a.t * 8) % 2 : 0;
  const bob = a.working ? (Math.floor(a.t * 6) % 2) : 0;

  R(c, x - 6, y - 1, 12, 3, "rgba(0,0,0,.28)");
  // kaki
  R(c, x - 4, y - 7 - (f ? 1 : 0), 4, 7 + (f ? 1 : 0), INK);
  R(c, x, y - 7 - (f ? 0 : 1), 4, 7 + (f ? 0 : 1), INK);
  R(c, x - 3, y - 6 - (f ? 1 : 0), 2, 5, "#3a4a6b");
  R(c, x + 1, y - 6 - (f ? 0 : 1), 2, 5, "#3a4a6b");
  // badan
  R(c, x - 5, y - 15, 10, 10, INK);
  R(c, x - 4, y - 14, 8, 8, a.shirt);
  R(c, x - 1, y - 13, 3, 3, "#fff");
  // lengan
  if (a.working) {
    R(c, x - 7, y - 13 + bob, 3, 5, INK);
    R(c, x + 4, y - 13 + (1 - bob), 3, 5, INK);
    R(c, x - 6, y - 12 + bob, 1, 3, a.shirt);
    R(c, x + 5, y - 12 + (1 - bob), 1, 3, a.shirt);
  } else {
    const sw = a.walking ? (f ? 1 : -1) : 0;
    R(c, x - 7, y - 14 + sw, 3, 7, INK);
    R(c, x + 4, y - 14 - sw, 3, 7, INK);
    R(c, x - 6, y - 13 + sw, 1, 5, a.shirt);
    R(c, x + 5, y - 13 - sw, 1, 5, a.shirt);
  }
  // kepala
  R(c, x - 5, y - 24, 10, 10, INK);
  R(c, x - 4, y - 23, 8, 8, a.skin);
  R(c, x - 4, y - 23, 8, 3, a.hair);
  R(c, x - 5, y - 22, 1, 4, a.hair);
  R(c, x + 4, y - 22, 1, 4, a.hair);
  const ex = a.dir;
  R(c, x - 2 + ex, y - 19, 1, 2, INK);
  R(c, x + 1 + ex, y - 19, 1, 2, INK);
  if (a.glasses) {
    R(c, x - 3 + ex, y - 20, 3, 1, INK);
    R(c, x + ex, y - 20, 3, 1, INK);
  }
};

// ---------- Kartu video yang berpindah ----------
const card = { x: 227, y: 146, s: 0 };
const drawCard = (c, t) => {
  if (card.s < 0.05) return;
  const w = Math.max(2, Math.round(9 * card.s));
  const h = Math.max(3, Math.round(15 * card.s));
  const x = Math.round(card.x - w / 2);
  const y = Math.round(card.y - h - 6 + Math.sin(t * 3) * 1.5);
  R(c, x - 1, y - 1, w + 2, h + 2, "#10224d");
  R(c, x, y, w, h, "#2f6bff");
  R(c, x, y, w, 2, "#6fa0ff");
  if (card.s > 0.6) {
    R(c, x + 3, y + 5, 1, 5, "#fff");
    R(c, x + 4, y + 6, 1, 3, "#fff");
    R(c, x + 5, y + 7, 1, 1, "#fff");
  }
};

const drawScreens = (c, t, active) => {
  STATIONS.forEach((st, si) => {
    st.screens.forEach(([x, y, w, h], k) => {
      if (si === active) {
        R(c, x, y, w, h, "#10343f");
        const colors = ["#4fd1c5", "#ffd166", "#ef476f"];
        for (let bx = 1; bx < w - 1; bx += 3) {
          const hh = 2 + Math.floor((Math.sin(t * 6 + bx * 1.3 + k) + 1) * 0.5 * (h - 4));
          R(c, x + bx, y + h - 1 - hh, 2, hh, colors[(bx / 3 + k) % 3 | 0]);
        }
      } else {
        R(c, x, y, w, h, "#243a63");
        R(c, x + 1, y + 2, w - 3, 1, "#3c5a94");
        R(c, x + 1, y + 5, Math.max(2, w - 6), 1, "#3c5a94");
      }
    });
  });
};

// ---------- Label DOM ----------
const labels = $("labels");
const signEls = STATIONS.map((st) => {
  const el = document.createElement("div");
  el.className = "sign";
  el.style.left = (st.sign[0] / W) * 100 + "%";
  el.style.top = (st.sign[1] / H) * 100 + "%";
  el.innerHTML = `<b>${st.name}</b><small>${st.sub}</small>`;
  labels.appendChild(el);
  return el;
});
[
  ["LOUNGE", "istirahat", 56, 132],
  ["BRIEF", "ide & catatan", 90, 8],
].forEach(([n, s, x, y]) => {
  const el = document.createElement("div");
  el.className = "sign dim";
  el.style.left = (x / W) * 100 + "%";
  el.style.top = (y / H) * 100 + "%";
  el.innerHTML = `<b>${n}</b><small>${s}</small>`;
  labels.appendChild(el);
});
const tagEls = agents.map((a) => {
  const el = document.createElement("div");
  el.className = "tag";
  el.innerHTML = `<i class="st"></i><b>${a.name}</b><small>${a.role}</small>`;
  el.dataset.agent = a.i;
  labels.appendChild(el);
  return el;
});

// ---------- Model status dari server ----------
let lastReal = window.__lastState || { queue: [], results: [], downloads: [], failed: [], status: null };
let selected = null;
let celebrateUntil = 0;
let demo = null;
const logs = [];
let prev = null;
const now = () => performance.now();

const clock = () => new Date().toLocaleTimeString("id-ID", { hour12: false });
const log = (text) => {
  logs.unshift({ t: clock(), text });
  logs.length = Math.min(logs.length, 8);
  lastSig = "";
};

const totals = (s) => ({
  clips: (s.results || []).reduce((n, r) => n + r.clips.length, 0),
  videos: (s.results || []).length,
});

let demoLogged = -1;
const demoState = () => {
  const el = (now() - demo) / 1000;
  const stageIdx = Math.floor(el / 6);
  const pct = Math.round(((el % 6) / 6) * 100);
  const base = { queue: [], results: lastReal.results || [], downloads: [], failed: [], status: null };
  if (stageIdx === 0) base.downloads = [{ id: "demo", url: "https://youtu.be/demo-video", status: "mengunduh", progress: pct }];
  else if (stageIdx === 1) base.status = { file: "demo_video.mp4", stage: "Transkripsi suara", detail: `${pct}%` };
  else if (stageIdx === 2) base.status = { file: "demo_video.mp4", stage: "Claude memilih momen terbaik", detail: "Membaca transkrip" };
  else if (stageIdx === 3) base.status = { file: "demo_video.mp4", stage: "Render klip", detail: `Klip ${1 + Math.floor(pct / 34)} dari 3: ${pct}%` };
  else if (stageIdx === 4) {
    celebrateUntil = Math.max(celebrateUntil, now() + 1000);
  } else {
    demo = null;
    log("DEMO selesai");
  }
  if (stageIdx !== demoLogged && stageIdx <= 4) {
    demoLogged = stageIdx;
    log(`DEMO: ${["Mengunduh video", "Transkripsi suara", "Claude memilih momen", "Render klip", "Klip selesai"][stageIdx]}`);
  }
  return base;
};

const model = (s) => {
  const t = now();
  const downloading = (s.downloads || []).find((d) => d.status === "mengunduh");
  let active = -1;
  let stage = "";
  let detail = "";
  let file = "";
  if (s.status) {
    stage = s.status.stage || "";
    file = s.status.file || "";
    detail = s.status.detail || "";
    const k = stage.toLowerCase();
    active = k.includes("transkrip") ? 1 : k.includes("claude") ? 2 : k.includes("render") ? 3 : -1;
  } else if (downloading) {
    active = 0;
    stage = "Mengunduh video";
    file = downloading.url;
    detail = `${Math.round(downloading.progress)}%`;
  }
  if (active < 0 && celebrateUntil > t) {
    active = 4;
    stage = "Klip selesai";
    detail = "Hasil siap diunduh";
  }
  const queue = (s.queue || []).filter((q) => !s.status || q.name !== s.status.file).map((q) => q.name);
  return { active, stage, detail, file, queue, ...totals(s) };
};

const detect = (s) => {
  const cur = {
    stage: s.status ? `${s.status.stage}|${s.status.file}` : "",
    queue: (s.queue || []).map((q) => q.name),
    dl: Object.fromEntries((s.downloads || []).map((d) => [d.id, d.status])),
    clips: totals(s).clips,
    failed: (s.failed || []).length,
  };
  if (prev) {
    if (cur.stage && cur.stage !== prev.stage) log(`${s.status.stage}: ${short(s.status.file, 26)}`);
    cur.queue.filter((n) => !prev.queue.includes(n)).forEach((n) => log(`Masuk antrean: ${short(n, 26)}`));
    Object.entries(cur.dl).forEach(([id, st]) => {
      if (prev.dl[id] !== st) log(`Unduhan ${st}`);
    });
    if (cur.clips > prev.clips) {
      log(`Hasil baru: ${cur.clips - prev.clips} klip`);
      celebrateUntil = now() + 14000;
    }
    if (cur.failed > prev.failed) log("Ada video yang gagal diproses");
  }
  prev = cur;
};

window.updateStudio = (s) => {
  lastReal = s;
  detect(s);
};
window.studioOnline = (ok) => {
  const chip = $("chipLive");
  if (chip) {
    chip.classList.toggle("off", !ok);
    chip.lastChild.textContent = ok ? " LIVE / TERHUBUNG" : " TERPUTUS";
  }
};

// ---------- Panel samping ----------
let lastSig = "";
const AGENT_STATE = (a) => (a.working ? "Bekerja" : a.walking ? "Berjalan" : "Santai");
const renderPanels = (m) => {
  const aIdx = selected !== null ? selected : m.active >= 0 ? m.active : 5;
  const a = agents[aIdx];
  const where = a.station >= 0 ? STATIONS[a.station].name : "LOUNGE";
  const task =
    m.active >= 0 && a.station === m.active
      ? `${m.stage}${m.detail ? " — " + m.detail : ""}`
      : "Menunggu tugas";
  const sig = JSON.stringify([m, aIdx, AGENT_STATE(a), logs, !!demo]);
  if (sig === lastSig) return;
  lastSig = sig;

  $("chipQueue").textContent = `ANTREAN ${m.queue.length}`;
  $("runBody").innerHTML =
    m.active >= 0
      ? `<div class="kv"><span class="dot on"></span> ${esc(m.stage.toUpperCase())}</div>
         <div class="big">${esc(short(m.file || "-", 40))}</div>
         <div class="mut">${esc(m.detail || "")}</div>
         ${m.queue.length ? `<div class="mut" style="margin-top:6px">Antrean: ${m.queue.map((n) => esc(short(n, 22))).join(", ")}</div>` : ""}`
      : `<div class="kv"><span class="dot"></span> TASK STANDBY</div>
         <div class="big">Menunggu video</div>
         <div class="mut">${m.queue.length ? `${m.queue.length} video di antrean` : "Seret video atau tempel link di bawah"}</div>`;

  $("agentBody").innerHTML = `
    <div class="agentHead"><span class="av" style="background:${a.shirt}">${a.name.slice(0, 2).toUpperCase()}</span>
      <div><b>${a.name}</b><div class="mut">${a.role}</div></div></div>
    <div class="two"><div class="box"><small>STATUS</small>${AGENT_STATE(a)}</div><div class="box"><small>STATION</small>${where}</div></div>
    <div class="box"><small>CURRENT TASK</small>${esc(short(task, 44))}</div>
    <div class="picker">${agents.map((g) => `<button data-pick="${g.i}" class="${g.i === aIdx ? "on" : ""}"><i style="background:${g.shirt}"></i>${g.name}</button>`).join("")}</div>`;

  $("logBody").innerHTML = logs.length
    ? logs.map((l) => `<div class="log"><time>${l.t}</time>${esc(l.text)}</div>`).join("")
    : `<div class="mut">Belum ada aktivitas. Coba tombol demo di bawah.</div>`;

  $("btnDemo").textContent = demo ? "■ Hentikan demo" : "▶ Putar demo tim AI";
};

$("agentBody").addEventListener("click", (e) => {
  const b = e.target.closest("[data-pick]");
  if (!b) return;
  selected = Number(b.dataset.pick);
  lastSig = "";
});
tagEls.forEach((el) =>
  el.addEventListener("click", () => {
    selected = Number(el.dataset.agent);
    lastSig = "";
  }),
);
$("btnDemo").addEventListener("click", () => {
  if (demo) {
    demo = null;
    celebrateUntil = 0;
    log("DEMO dihentikan");
  } else {
    demo = now();
    demoLogged = -1;
    log("DEMO dimulai");
  }
  lastSig = "";
});
$("btnReset").addEventListener("click", () => {
  demo = null;
  selected = null;
  celebrateUntil = 0;
  logs.length = 0;
  lastSig = "";
});

// ---------- Loop ----------
let last = performance.now();
let curModel = model(lastReal);
let panelTimer = 0;

const frame = () => {
  const t = performance.now();
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;

  const s = demo ? demoState() : lastReal;
  curModel = model(s);

  agents.forEach((a) => stepAgent(a, dt, curModel.active));

  // kartu video bergerak ke stasiun aktif
  if (curModel.active >= 0) {
    const tgt = STATIONS[curModel.active].card;
    card.x += (tgt.x - card.x) * Math.min(1, dt * 4);
    card.y += (tgt.y - card.y) * Math.min(1, dt * 4);
    card.s += (1 - card.s) * Math.min(1, dt * 6);
  } else {
    card.s += (0 - card.s) * Math.min(1, dt * 6);
  }

  const sec = t / 1000;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(bgC, 0, 0);
  drawScreens(ctx, sec, curModel.active);
  [...agents].sort((p, q) => p.y - q.y).forEach((a) => drawAgent(ctx, a));
  ctx.drawImage(fgC, 0, 0);
  drawCard(ctx, sec);

  // label DOM
  agents.forEach((a, i) => {
    const el = tagEls[i];
    el.style.left = (a.x / W) * 100 + "%";
    el.style.top = ((a.y - 27) / H) * 100 + "%";
    el.classList.toggle("sel", (selected !== null ? selected : curModel.active >= 0 ? curModel.active : 5) === i);
    el.classList.toggle("work", a.working);
  });
  signEls.forEach((el, i) => el.classList.toggle("on", i === curModel.active));

  panelTimer += dt;
  if (panelTimer > 0.25) {
    panelTimer = 0;
    renderPanels(curModel);
  }
  requestAnimationFrame(frame);
};

setInterval(() => {
  const el = $("clock");
  if (el) el.textContent = new Date().toLocaleString("id-ID", { hour12: false });
}, 1000);
$("clock").textContent = new Date().toLocaleString("id-ID", { hour12: false });

if (window.__lastState) window.updateStudio(window.__lastState);
renderPanels(curModel);
requestAnimationFrame(frame);
})();
