/* eslint-disable @remotion/deterministic-randomness -- kode browser, bukan komposisi Remotion */
/* global document, window, performance, matchMedia, ResizeObserver, setInterval */
// Virtual Office AI Agent: kantor 3D isometrik. Karakter berjalan dan bekerja sesuai tahap pipeline.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const short = (s, n = 24) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const clean = (f) => short(String(f || "").replace(/\.[a-z0-9]{2,4}$/i, ""), 22);
const SPEED = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.4 : 1;

const host = $("office");
const bubbleLayer = $("bubbles");

// ---------- Renderer, kamera, cahaya ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.insertBefore(renderer.domElement, bubbleLayer);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camera.position.set(16, 13.5, 16);
const TARGET = new THREE.Vector3(0, 0.4, 0);
camera.lookAt(TARGET);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TARGET);
controls.enableDamping = true;
controls.enablePan = false;
controls.minZoom = 0.75;
controls.maxZoom = 2.4;
controls.minPolarAngle = 0.55;
controls.maxPolarAngle = 1.2;
controls.minAzimuthAngle = Math.PI / 4 - 0.55;
controls.maxAzimuthAngle = Math.PI / 4 + 0.55;
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0xdbe6f4, 1.35));
const sun = new THREE.DirectionalLight(0xfff3df, 1.9);
sun.position.set(10, 16, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 50 });
sun.shadow.bias = -0.0004;
sun.shadow.radius = 4;
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

// ---------- Helper bentuk ----------
const mats = {};
const M = (color, o = {}) => {
  const key = color + JSON.stringify(o);
  return (mats[key] ??= new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.03, ...o }));
};
const box = (w, h, d, material, x, y, z, parent = world, cast = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
};
const cyl = (rt, rb, h, material, x, y, z, parent = world, seg = 16) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
};
const sph = (r, material, x, y, z, parent = world, sx = 1, sy = 1, sz = 1) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  parent.add(m);
  return m;
};

// ---------- Lantai dan dinding ----------
const floorTex = (() => {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#ead3ab";
  g.fillRect(0, 0, 512, 512);
  let s = 7;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let x = 0; x < 512; x += 32) {
    g.fillStyle = `rgba(${150 + rnd() * 40},${105 + rnd() * 30},${60 + rnd() * 20},${0.1 + rnd() * 0.12})`;
    g.fillRect(x, 0, 32, 512);
    g.fillStyle = "rgba(120,80,40,.28)";
    g.fillRect(x, 0, 1.5, 512);
    for (let y = rnd() * 200; y < 512; y += 180 + rnd() * 140) g.fillRect(x, y, 32, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.5, 1.5);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
})();
box(20.8, 0.5, 12.8, M(0xf6f3ec), 0, -0.3, 0);
box(20.9, 0.08, 12.9, M(0xcdb892), 0, -0.52, 0);
{
  const f = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 12), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55 }));
  f.position.set(0, -0.05, 0);
  f.receiveShadow = true;
  world.add(f);
}
// dinding belakang (z=-6) dan kiri (x=-10)
const WALL = M(0xf4efe6);
const TRIM = M(0xd9c6a2);
box(20.4, 2.3, 0.3, WALL, 0, 1.15, -6.15);
box(20.4, 0.12, 0.34, TRIM, 0, 2.34, -6.15);
box(20.4, 0.5, 0.34, TRIM, 0, 0.25, -6.15);
box(0.3, 2.3, 12.4, WALL, -10.15, 1.15, 0);
box(0.34, 0.12, 12.4, TRIM, -10.15, 2.34, 0);
box(0.34, 0.5, 12.4, TRIM, -10.15, 0.25, 0);
{
  const glass = M(0xbfe3f5, { transparent: true, opacity: 0.55, roughness: 0.1 });
  [-6, 0, 6].forEach((x) => {
    box(3.2, 1.1, 0.06, glass, x, 1.45, -5.97, world, false);
    box(3.3, 0.06, 0.1, M(0xffffff), x, 2.02, -5.96, world, false);
    box(3.3, 0.06, 0.1, M(0xffffff), x, 0.9, -5.96, world, false);
    box(0.06, 1.1, 0.1, M(0xffffff), x, 1.45, -5.96, world, false);
  });
  [-3.5, 2.5].forEach((z) => {
    box(0.06, 1.1, 3.0, glass, -9.97, 1.45, z, world, false);
    box(0.1, 0.06, 3.1, M(0xffffff), -9.96, 2.02, z, world, false);
  });
}

// ---------- Perabot ----------
const GLASS = new THREE.MeshPhysicalMaterial({ color: 0xcfeaf5, transparent: true, opacity: 0.26, roughness: 0.05, side: THREE.DoubleSide });
const ALU = M(0xdfe3ea);
const glassPanel = (w, d, x, z) => {
  const horizontal = w > d;
  box(w, 1.8, d, GLASS, x, 0.9, z, world, false);
  box(w, 0.06, d, ALU, x, 1.82, z);
  box(w, 0.06, d, ALU, x, 0.03, z);
  const n = Math.max(1, Math.round((horizontal ? w : d) / 1.8));
  for (let i = 0; i <= n; i++) {
    const t = (i / n - 0.5) * (horizontal ? w : d);
    box(horizontal ? 0.06 : d + 0.0, 1.8, horizontal ? 0.06 : 0.06, ALU, horizontal ? x + t : x, 0.9, horizontal ? z : z + t);
  }
};

const screenMats = [[], [], [], [], []];
const STATION_COLORS = [0xf59e0b, 0x14b8a6, 0x8b5cf6, 0xef4444, 0x22c55e];

const monitor = (g, x, z, si, w = 0.74) => {
  box(0.1, 0.22, 0.1, M(0x4b5563), x, 0.86, z, g);
  box(0.38, 0.03, 0.22, M(0x4b5563), x, 0.77, z, g);
  box(w, 0.44, 0.05, M(0x1c2230), x, 1.14, z, g);
  const scr = new THREE.MeshStandardMaterial({ color: 0x23324f, emissive: STATION_COLORS[si], emissiveIntensity: 0.05, roughness: 0.3 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.08, 0.36), scr);
  plane.position.set(x, 1.14, z - 0.028);
  plane.rotation.y = Math.PI; // layar menghadap -z (ke arah kursi)
  g.add(plane);
  screenMats[si].push(scr);
};

const desk = (x, z, si, monitors = 1) => {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  world.add(g);
  box(2.3, 0.08, 1.05, M(0xecd2a8), 0, 0.75, 0, g);
  [[-1.05, -0.45], [1.05, -0.45], [-1.05, 0.45], [1.05, 0.45]].forEach(([lx, lz]) => box(0.07, 0.72, 0.07, M(0xf3f3f1), lx, 0.36, lz, g));
  box(0.5, 0.45, 0.8, M(0xf3f3f1), 0.75, 0.5, 0, g);
  box(0.5, 0.08, 0.8, M(0xe0c698), 0.75, 0.27, 0, g, false);
  if (monitors === 1) monitor(g, 0, 0.12, si);
  else {
    monitor(g, -0.5, 0.12, si, 0.66);
    monitor(g, 0.38, 0.12, si, 0.66);
  }
  box(0.5, 0.025, 0.16, M(0x2a2f3a), -0.05, 0.795, -0.3, g, false);
  box(0.09, 0.03, 0.13, M(0x2a2f3a), 0.5, 0.795, -0.3, g, false);
  box(0.16, 0.12, 0.12, M(0xffffff), -0.95, 0.85, 0.2, g, false);
  return g;
};

const chair = (x, z, rot = 0) => {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  world.add(g);
  const dark = M(0x2a2e38);
  cyl(0.28, 0.28, 0.04, dark, 0, 0.1, 0, g, 5);
  cyl(0.04, 0.04, 0.22, dark, 0, 0.2, 0, g);
  box(0.52, 0.09, 0.5, dark, 0, 0.34, 0, g);
  box(0.5, 0.55, 0.08, dark, 0, 0.66, -0.25, g);
  box(0.06, 0.18, 0.3, dark, -0.3, 0.45, 0, g, false);
  box(0.06, 0.18, 0.3, dark, 0.3, 0.45, 0, g, false);
  return g;
};

const plant = (x, z, s = 1) => {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  world.add(g);
  cyl(0.28, 0.2, 0.42, M(0xf1ede4), 0, 0.21, 0, g);
  const greens = [0x2f8f4e, 0x3da35d, 0x58b86f, 0x287a43];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.85 + (i % 3) * 0.15, 6), M(greens[i % 4]));
    leaf.position.set(Math.cos(a) * 0.14, 0.78, Math.sin(a) * 0.14);
    leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
};

// stasiun kerja
const DESKS = [
  { x: -6, z: 2.5, mon: 1 },
  { x: -2, z: 1.5, mon: 2 },
  { x: 5.5, z: -3.2, mon: 2 },
  { x: 6.5, z: 3.0, mon: 2 },
  { x: -6.5, z: -3.5, mon: 1 },
];
DESKS.forEach((d, i) => {
  desk(d.x, d.z, i, d.mon);
});

// ruang kaca Claude Editor
glassPanel(5.4, 0.08, 7.3, -1.2);
glassPanel(0.08, 4.8, 3.0, -3.6);
box(0.12, 1.8, 0.12, ALU, 4.6, 0.9, -1.2);
box(0.12, 1.8, 0.12, ALU, 3.0, 0.9, -1.2);
box(2.6, 0.04, 1.6, M(0xdfe9f5), 7.6, 0.02, -3.6, world, false); // karpet ruang

// sekat kain
box(0.1, 0.95, 1.6, M(0x93a98a), -4.0, 0.48, 1.6);
box(0.1, 0.95, 1.6, M(0x93a98a), 2.2, 0.48, 1.6);

// sofa area istirahat
{
  const g = new THREE.Group();
  g.position.set(0, 0, -5.1);
  world.add(g);
  const sofa = M(0x7f9a70);
  box(2.8, 0.45, 1.0, sofa, 0, 0.25, 0, g);
  box(2.8, 0.7, 0.3, sofa, 0, 0.7, -0.4, g);
  box(0.3, 0.6, 1.0, M(0x6f8a62), -1.4, 0.45, 0, g);
  box(0.3, 0.6, 1.0, M(0x6f8a62), 1.4, 0.45, 0, g);
  box(0.5, 0.4, 0.14, M(0xf4c95d), -0.7, 0.62, -0.2, g);
  box(0.5, 0.4, 0.14, M(0xe58f6b), 0.7, 0.62, -0.2, g);
  cyl(0.55, 0.55, 0.05, M(0xecd2a8), 0, 0.42, 1.55, world);
  cyl(0.06, 0.06, 0.4, M(0x8a6a3c), 0, 0.2, -3.55, world);
  box(0.9, 0.05, 0.6, M(0xecd2a8), 0, 0.43, -3.5, world);
}
// meja bundar + bangku
cyl(0.85, 0.85, 0.07, M(0xecd2a8), 1.8, 0.72, 3.5);
cyl(0.1, 0.1, 0.7, M(0x8a6a3c), 1.8, 0.35, 3.5);
[[0.9, 3.0], [2.7, 3.0], [1.8, 2.4]].forEach(([sx, sz]) => {
  cyl(0.24, 0.24, 0.3, M(0x2a2e38), sx, 0.2, sz);
});
box(0.5, 0.03, 0.4, M(0xffffff), 1.5, 0.77, 3.4);
box(0.3, 0.1, 0.3, M(0xf59e0b), 2.1, 0.8, 3.6);
// rak buku dan lemari
{
  const g = new THREE.Group();
  g.position.set(-3, 0, -5.7);
  world.add(g);
  box(2.4, 1.6, 0.45, M(0xd9b98a), 0, 0.8, 0, g);
  let s = 3;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const bookCols = [0xd94f4f, 0x4f7bd9, 0xe6b422, 0x4fb36b, 0x8e5bd0, 0xf2f2f2];
  [0.35, 0.8, 1.25].forEach((by) => {
    box(2.3, 0.04, 0.4, M(0xb8935f), 0, by - 0.1, 0.02, g, false);
    for (let bx = -1.05; bx < 1.0; bx += 0.14) {
      const bh = 0.25 + rnd() * 0.2;
      box(0.1, bh, 0.28, M(bookCols[Math.floor(rnd() * 6)]), bx, by - 0.08 + bh / 2, 0.05, g, false);
    }
  });
}
box(1.8, 0.75, 0.55, M(0xd9b98a), 4.5, 0.38, 5.6);
box(1.7, 0.04, 0.5, M(0xecd2a8), 4.5, 0.77, 5.6);
box(0.5, 0.35, 0.4, M(0xffffff), 4.1, 0.97, 5.6);
// printer
box(0.9, 0.5, 0.6, M(0xe5e8ee), 9.2, 0.25, 4.0);
box(0.7, 0.08, 0.4, M(0x4b5563), 9.2, 0.54, 4.0);

[[-9.3, -5.2, 1.6], [-9.3, 5.4, 1.3], [9.4, 5.3, 1.4], [9.4, -5.3, 1.5], [2.9, 5.4, 1], [-0.9, -5.6, 1.1], [3.6, -1.9, 0.9], [-4.6, -5.4, 1]].forEach(([x, z, s]) => plant(x, z, s));

// kursi di tiap meja kerja (di sisi utara meja)
const SEATS = [
  { x: -6, z: 1.4 },
  { x: -2, z: 0.4 },
  { x: 5.5, z: -4.3 },
  { x: 6.5, z: 1.9 },
  { x: -6.5, z: -4.6 },
];
SEATS.forEach((s) => chair(s.x, s.z - 0.05, Math.PI));
chair(-4.2, 1.0, Math.PI * 0.5);

// ---------- Jalur jalan ----------
const NODES = {
  A: [-8.2, -0.5], B: [-6, -0.5], C: [-4, -0.5], D: [-2, -0.5], E: [-0.2, -0.5], F: [3.8, -0.5], G: [6.5, -0.5], H: [8.8, -0.5],
  R1: [3.8, -2.4], R2: [3.6, -4.4], P: [-8.2, -4.6],
  W: [-8.2, 5.0], FZ: [-3, 5.0], V2: [-0.2, 5.0], Y: [3.5, 5.0], X: [8.8, 5.0],
};
const EDGES = [
  ["A", "B"], ["B", "C"], ["C", "D"], ["D", "E"], ["E", "F"], ["F", "G"], ["G", "H"], ["F", "R1"], ["R1", "R2"],
  ["A", "P"], ["A", "W"], ["W", "FZ"], ["FZ", "V2"], ["V2", "Y"], ["Y", "X"], ["H", "X"], ["E", "V2"],
];
const ADJ = {};
EDGES.forEach(([a, b]) => {
  const d = Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1]);
  (ADJ[a] ??= []).push([b, d]);
  (ADJ[b] ??= []).push([a, d]);
});
const nearestNode = (x, z) =>
  Object.keys(NODES).reduce(
    (best, k) => (Math.hypot(NODES[k][0] - x, NODES[k][1] - z) < Math.hypot(NODES[best][0] - x, NODES[best][1] - z) ? k : best),
    "A",
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
const route = (x, z, to) => {
  const a = nearestNode(x, z);
  const b = to.via || nearestNode(to.x, to.z);
  const pts = dijkstra(a, b).map((n) => ({ x: NODES[n][0], z: NODES[n][1] }));
  pts.push({ x: to.x, z: to.z });
  return pts;
};

const STATIONS = [
  { name: "Antrean & Unduh", seat: { ...SEATS[0], via: "B" }, visit: { x: -4.7, z: 1.0, via: "B" } },
  { name: "Transkripsi", seat: { ...SEATS[1], via: "D" }, visit: { x: -0.9, z: 0.3, via: "D" } },
  { name: "Claude Editor", seat: { ...SEATS[2], via: "R2" }, visit: { x: 3.8, z: -3.6, via: "R2" } },
  { name: "Render", seat: { ...SEATS[3], via: "G" }, visit: { x: 7.9, z: 1.5, via: "G" } },
  { name: "Hasil Klip", seat: { ...SEATS[4], via: "P" }, visit: { x: -8.2, z: -3.4, via: "A" } },
];
const SPOTS = [
  { x: 0, z: -2.4, via: "E" },
  { x: -0.2, z: 3.4, via: "E" },
  { x: 8.8, z: 2.0, via: "H" },
  { x: -3.5, z: -3.6, via: "C" },
  { x: -3, z: 4.2, via: "FZ" },
];

// ---------- Karakter ----------
const DEFS = [
  { name: "Aoi", role: "Koordinator Unduhan", station: 0, shirt: 0x2f5bd3, hair: 0x2b2b3a, skin: 0xf2c9a5 },
  { name: "Sora", role: "Juru Transkripsi", station: 1, shirt: 0xf2b705, hair: 0x5a3825, skin: 0xe8b98f },
  { name: "Ren", role: "Editor Claude", station: 2, shirt: 0xe8452c, hair: 0x1e1e1e, skin: 0xf2c9a5 },
  { name: "Kai", role: "Operator Render", station: 3, shirt: 0x7b4bd6, hair: 0xc7c7d1, skin: 0xd9a67a },
  { name: "Miu", role: "Penjaga Hasil", station: 4, shirt: 0xe060a0, hair: 0x6b3a2a, skin: 0xf2c9a5 },
  { name: "Hina", role: "Kurir Studio", station: -1, shirt: 0x2fa564, hair: 0x8a5a2b, skin: 0xf2c9a5 },
];

const buildAgent = (d) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const dark = M(0x2d3550);
  const torso = box(0.46, 0.56, 0.28, M(d.shirt), 0, 0.92, 0, body);
  box(0.18, 0.2, 0.02, M(0xffffff), 0, 0.95, 0.15, body, false);
  const head = new THREE.Group();
  head.position.set(0, 1.4, 0);
  body.add(head);
  sph(0.21, M(d.skin), 0, 0, 0, head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.225, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), M(d.hair));
  hair.position.set(0, 0.02, -0.01);
  hair.castShadow = true;
  head.add(hair);
  box(0.04, 0.06, 0.02, M(0x1b1b2f), -0.07, 0.0, 0.2, head, false);
  box(0.04, 0.06, 0.02, M(0x1b1b2f), 0.07, 0.0, 0.2, head, false);

  const leg = (sx) => {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.12, 0.62, 0);
    body.add(hip);
    box(0.16, 0.3, 0.16, dark, 0, -0.15, 0, hip);
    const knee = new THREE.Group();
    knee.position.set(0, -0.3, 0);
    hip.add(knee);
    box(0.15, 0.28, 0.15, dark, 0, -0.14, 0, knee);
    box(0.17, 0.07, 0.24, M(0x111827), 0, -0.3, 0.04, knee, false);
    return { hip, knee };
  };
  const arm = (sx) => {
    const sh = new THREE.Group();
    sh.position.set(sx * 0.3, 1.16, 0);
    body.add(sh);
    box(0.12, 0.5, 0.12, M(d.shirt), 0, -0.24, 0, sh);
    sph(0.07, M(d.skin), 0, -0.52, 0, sh);
    return sh;
  };
  const legL = leg(-1);
  const legR = leg(1);
  const armL = arm(-1);
  const armR = arm(1);
  world.add(root);
  return { root, body, head, legL, legR, armL, armR, torso };
};

const agents = DEFS.map((d, i) => {
  const home = d.station >= 0 ? STATIONS[d.station].seat : SPOTS[0];
  const rig = buildAgent(d);
  const a = {
    ...d,
    i,
    rig,
    x: home.x,
    z: home.z,
    face: 0,
    path: [],
    t: Math.random() * 10,
    idle: 1 + Math.random() * 4,
    sit: d.station >= 0 ? 1 : 0,
    wantWork: false,
    working: false,
    walking: false,
    say: "",
    sayUntil: 0,
    errand: null,
  };
  return a;
});
const courier = agents[5];

const goTo = (a, target) => {
  a.path = route(a.x, a.z, target);
};
const pickIdle = (a) => {
  const spots = [...SPOTS];
  if (a.station >= 0) spots.push(STATIONS[a.station].seat);
  const far = spots.filter((s) => Math.hypot(s.x - a.x, s.z - a.z) > 2);
  goTo(a, far[Math.floor(Math.random() * far.length)]);
};
const sayFor = (a, text, secs) => {
  a.say = text;
  a.sayUntil = performance.now() + secs * 1000;
};

// kurir: antar video antar ruangan
const errands = [];
const requestErrand = (from, to, file) => {
  errands.push({ from, to, file });
  if (errands.length > 4) errands.shift();
};
const stepCourier = () => {
  const a = courier;
  if (a.errand) {
    if (a.path.length === 0) {
      const e = a.errand;
      if (e.phase === 0) {
        sayFor(a, `Mengambil ${clean(e.file)}`, 1.6);
        e.phase = 1;
        e.hold = 1.4;
      } else if (e.phase === 1) {
        e.hold -= 0.016;
        if (e.hold <= 0) {
          e.phase = 2;
          goTo(a, STATIONS[e.to].visit);
        }
      } else if (e.phase === 2) {
        sayFor(a, `Menyerahkan ke ${DEFS[e.to].name}`, 2.4);
        e.phase = 3;
        e.hold = 2;
      } else {
        e.hold -= 0.016;
        if (e.hold <= 0) {
          a.errand = null;
          a.idle = 1;
        }
      }
    }
    return true;
  }
  if (errands.length) {
    const e = errands.shift();
    a.errand = { ...e, phase: 0 };
    sayFor(a, `Menuju ruangan ${DEFS[e.from].name}`, 2.5);
    goTo(a, STATIONS[e.from].visit);
    return true;
  }
  return false;
};

const stepAgent = (a, dt, activeSet) => {
  const want = a.station >= 0 && activeSet.has(a.station);
  const busyCourier = a === courier && stepCourier();
  if (!busyCourier) {
    if (want && !a.wantWork) {
      a.wantWork = true;
      goTo(a, STATIONS[a.station].seat);
    }
    if (!want && a.wantWork) {
      a.wantWork = false;
      a.idle = 1.2;
    }
    if (!want && a.path.length === 0) {
      a.idle -= dt;
      if (a.idle <= 0) {
        pickIdle(a);
        a.idle = 5 + Math.random() * 8;
      }
    }
  }
  a.working = want && a.path.length === 0 && !busyCourier;
  a.t += dt;
  a.walking = a.path.length > 0;

  if (a.walking) {
    const p = a.path[0];
    const dx = p.x - a.x;
    const dz = p.z - a.z;
    const d = Math.hypot(dx, dz);
    const sp = 1.9 * SPEED * dt;
    if (d <= sp) {
      a.x = p.x;
      a.z = p.z;
      a.path.shift();
    } else {
      a.x += (dx / d) * sp;
      a.z += (dz / d) * sp;
      const target = Math.atan2(dx, dz);
      let diff = target - a.face;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      a.face += diff * Math.min(1, dt * 10);
    }
  } else if (a.working) {
    // menghadap meja (ke +z)
    let diff = -a.face;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    a.face += diff * Math.min(1, dt * 8);
  }

  // duduk saat bekerja
  const sitTarget = a.working ? 1 : 0;
  a.sit += (sitTarget - a.sit) * Math.min(1, dt * 6);

  const r = a.rig;
  const ph = a.t * 7 * SPEED;
  const walkAmt = a.walking ? 1 : 0;
  const s = a.sit;
  r.root.position.set(a.x, 0, a.z);
  r.root.rotation.y = a.face;
  r.body.position.y = -0.3 * s + (a.walking ? Math.abs(Math.sin(ph)) * 0.04 : 0);
  const swing = Math.sin(ph) * 0.7 * walkAmt;
  r.legL.hip.rotation.x = -swing * (1 - s) - (Math.PI / 2) * s;
  r.legR.hip.rotation.x = swing * (1 - s) - (Math.PI / 2) * s;
  r.legL.knee.rotation.x = Math.max(0, Math.sin(ph + 1)) * 0.5 * walkAmt * (1 - s) + (Math.PI / 2) * s;
  r.legR.knee.rotation.x = Math.max(0, -Math.sin(ph + 1)) * 0.5 * walkAmt * (1 - s) + (Math.PI / 2) * s;
  const type = a.working ? Math.sin(a.t * 14) * 0.18 : 0;
  r.armL.rotation.x = (swing * 0.9) * (1 - s) + (-1.05 + type) * s;
  r.armR.rotation.x = (-swing * 0.9) * (1 - s) + (-1.05 - type) * s;
  r.head.rotation.x = a.working ? 0.12 + Math.sin(a.t * 2) * 0.03 : Math.sin(a.t * 1.2) * 0.02;
};

// ---------- Kartu video (job) ----------
const cardPalette = [0x2563eb, 0x7c3aed, 0x0891b2, 0xdb2777, 0xea580c, 0x16a34a];
const hashColor = (s) => cardPalette[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % cardPalette.length];
const makeCard = (color) => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.82, 0.07),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.35 }),
  );
  body.castShadow = true;
  g.add(body);
  const tri = new THREE.Shape();
  tri.moveTo(-0.07, -0.1);
  tri.lineTo(-0.07, 0.1);
  tri.lineTo(0.11, 0);
  const play = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  play.position.z = 0.04;
  g.add(play);
  world.add(g);
  return g;
};

const stageInfo = (stage) => {
  const k = (stage || "").toLowerCase();
  if (k.includes("antre claude")) return { st: 2, wait: true };
  if (k.includes("antre render")) return { st: 3, wait: true };
  if (k.includes("transkrip")) return { st: 1, wait: false };
  if (k.includes("claude")) return { st: 2, wait: false };
  if (k.includes("render")) return { st: 3, wait: false };
  return { st: -1, wait: false };
};

const cards = new Map(); // id -> {g, tag, pos}
const queueDocs = [];
const resultCards = [];

const tagFor = () => {
  const el = document.createElement("div");
  el.className = "jobtag";
  bubbleLayer.appendChild(el);
  return el;
};

const syncCards = (m) => {
  const seen = new Set();
  m.jobs.forEach((j, idx) => {
    const info = stageInfo(j.stage);
    if (info.st < 0) return;
    seen.add(j.id);
    let c = cards.get(j.id);
    if (!c) {
      const home = DESKS[1];
      c = { g: makeCard(hashColor(j.id)), tag: tagFor(), pos: new THREE.Vector3(home.x - 2, 0.9, home.z + 2), rot: 0 };
      c.g.position.copy(c.pos);
      cards.set(j.id, c);
    }
    const d = DESKS[info.st];
    c.target = info.wait
      ? new THREE.Vector3(d.x - 0.85 - idx * 0.0, 0.84, d.z + 0.22)
      : new THREE.Vector3(d.x, 1.95, d.z - 0.05);
    c.flat = info.wait;
    c.job = j;
  });
  [...cards.keys()].forEach((id) => {
    if (!seen.has(id)) {
      const c = cards.get(id);
      world.remove(c.g);
      c.tag.remove();
      cards.delete(id);
    }
  });

  // antrean (belum masuk transkripsi): tumpukan berkas di meja Antrean
  const want = Math.min(m.queue.length, 8);
  while (queueDocs.length < want) {
    const i = queueDocs.length;
    const mesh = box(0.62, 0.05, 0.46, M(0xffffff), DESKS[0].x - 0.8, 0.82 + i * 0.055, DESKS[0].z + 0.15, world);
    mesh.rotation.y = ((i * 37) % 11) * 0.04 - 0.2;
    queueDocs.push(mesh);
  }
  while (queueDocs.length > want) {
    const mesh = queueDocs.pop();
    world.remove(mesh);
  }
  // hasil: kartu berdiri di rak meja Hasil
  const wr = Math.min(m.clips, 12);
  while (resultCards.length < wr) {
    const i = resultCards.length;
    const c = makeCard(cardPalette[i % cardPalette.length]);
    c.scale.setScalar(0.55);
    c.position.set(DESKS[4].x - 1.0 + (i % 6) * 0.38, 0.83 + 0.24, DESKS[4].z - 0.15 - Math.floor(i / 6) * 0.3);
    resultCards.push(c);
  }
  while (resultCards.length > wr) world.remove(resultCards.pop());
};

// ---------- Status dari server + demo ----------
let lastReal = window.__lastState || { jobs: [], queue: [], results: [], downloads: [], failed: [] };
let demo = null;
let celebrateUntil = 0;
let prevStages = new Map();
let primed = false;
const now = () => performance.now();

const totals = (s) => ({
  clips: (s.results || []).reduce((n, r) => n + r.clips.length, 0),
  videos: (s.results || []).length,
});

const DEMO_NAMES = ["tips_menabung.mp4", "podcast_ep12.mp4", "vlog_bali.mp4"];
const demoDur = { t: 6, c: 6, r: 8 };
const demoPlan = (() => {
  const plan = [];
  let tEndPrev = 2;
  let cEndPrev = 0;
  let rEndPrev = 0;
  DEMO_NAMES.forEach((name) => {
    const tS = tEndPrev;
    const tE = tS + demoDur.t;
    const cS = Math.max(tE, cEndPrev);
    const cE = cS + demoDur.c;
    const rS = Math.max(cE, rEndPrev);
    const rE = rS + demoDur.r;
    plan.push({ name, tS, tE, cS, cE, rS, rE });
    tEndPrev = tE;
    cEndPrev = cE;
    rEndPrev = rE;
  });
  return plan;
})();
const DEMO_END = demoPlan[demoPlan.length - 1].rE + 3;

const demoState = () => {
  const t = (now() - demo) / 1000;
  const s = { jobs: [], queue: [], results: lastReal.results || [], downloads: [], failed: [] };
  demoPlan.forEach((p) => {
    const id = p.name.replace(/\.mp4$/, "");
    const pct = (a, b) => Math.min(99, Math.round(((t - a) / (b - a)) * 100));
    if (t < p.tS) s.queue.push({ name: p.name });
    else if (t < p.tE) s.jobs.push({ id, file: p.name, stage: "Transkripsi suara", detail: `${pct(p.tS, p.tE)}%` });
    else if (t < p.cS) s.jobs.push({ id, file: p.name, stage: "Antre Claude", detail: "" });
    else if (t < p.cE) s.jobs.push({ id, file: p.name, stage: "Claude memilih momen terbaik", detail: "" });
    else if (t < p.rS) s.jobs.push({ id, file: p.name, stage: "Antre render", detail: "" });
    else if (t < p.rE) s.jobs.push({ id, file: p.name, stage: "Render klip", detail: `Klip ${1 + Math.floor(pct(p.rS, p.rE) / 34)} dari 3: ${pct(p.rS, p.rE)}%` });
    else if (t - p.rE < 0.1) celebrateUntil = now() + 5000;
  });
  if (t > DEMO_END) {
    demo = null;
    setDemoButton();
  }
  return s;
};

const buildModel = (s) => {
  const jobs = (s.jobs || []).filter((j) => stageInfo(j.stage).st >= 0);
  const downloading = (s.downloads || []).find((d) => d.status === "mengunduh");
  const active = new Set();
  jobs.forEach((j) => {
    const i = stageInfo(j.stage);
    if (!i.wait) active.add(i.st);
  });
  if (downloading || (s.queue || []).length > 0) active.add(0);
  if (celebrateUntil > now()) active.add(4);
  return {
    jobs,
    queue: (s.queue || []).map((q) => q.name),
    downloading,
    active,
    ...totals(s),
  };
};

// deteksi perpindahan job antar tahap -> kurir mengantar
const detectMoves = (m) => {
  const cur = new Map(m.jobs.map((j) => [j.id, j]));
  if (primed) {
    cur.forEach((j, id) => {
      const next = stageInfo(j.stage).st;
      const prevJ = prevStages.get(id);
      if (!prevJ) {
        if (next === 1) requestErrand(0, 1, j.file);
      } else {
        const before = stageInfo(prevJ.stage).st;
        if (before >= 0 && next !== before) requestErrand(before, next, j.file);
      }
    });
    prevStages.forEach((j, id) => {
      if (!cur.has(id) && stageInfo(j.stage).st === 3) {
        requestErrand(3, 4, j.file);
        celebrateUntil = Math.max(celebrateUntil, now() + 6000);
      }
    });
  }
  prevStages = cur;
  primed = true;
};

let lastClips = null;
window.updateStudio = (s) => {
  lastReal = s;
  const c = totals(s).clips;
  if (lastClips !== null && c > lastClips) celebrateUntil = Math.max(celebrateUntil, now() + 10000);
  lastClips = c;
};
window.studioOnline = (ok) => {
  const chip = $("chipLive");
  if (chip) {
    chip.classList.toggle("off", !ok);
    chip.lastChild.textContent = ok ? " LIVE" : " TERPUTUS";
  }
};

// ---------- Balon ucapan ----------
const bubbleEls = agents.map((a) => {
  const el = document.createElement("div");
  el.className = "bubble";
  el.innerHTML = `<i></i><b>${a.name}</b><span></span>`;
  bubbleLayer.appendChild(el);
  return el;
});

const workText = (a, m) => {
  const j = (stg) => m.jobs.find((x) => stageInfo(x.stage).st === stg && !stageInfo(x.stage).wait);
  switch (a.station) {
    case 0:
      return m.downloading ? `Mengunduh link · ${Math.round(m.downloading.progress)}%` : `Mengatur antrean · ${m.queue.length} video`;
    case 1: {
      const x = j(1);
      return x ? `Transkripsi ${clean(x.file)}${x.detail ? " · " + x.detail : ""}` : "Transkripsi";
    }
    case 2: {
      const x = j(2);
      return x ? `Memilih momen · ${clean(x.file)}` : "Memilih momen";
    }
    case 3: {
      const x = j(3);
      return x ? `Render ${clean(x.file)}${x.detail ? " · " + x.detail : ""}` : "Render";
    }
    default:
      return "Klip selesai, siap diunduh";
  }
};

const tmpV = new THREE.Vector3();
const project = (x, y, z, w, h) => {
  tmpV.set(x, y, z).project(camera);
  return [(tmpV.x * 0.5 + 0.5) * w, (-tmpV.y * 0.5 + 0.5) * h, tmpV.z];
};

// ---------- Panel alur job ----------
let flowSig = "";
const renderFlow = (m) => {
  const stepOf = (stage) => {
    const k = (stage || "").toLowerCase();
    if (k.includes("antre claude")) return { done: 1, run: -1, wait: 1 };
    if (k.includes("antre render")) return { done: 2, run: -1, wait: 2 };
    if (k.includes("transkrip")) return { done: 0, run: 0, wait: -1 };
    if (k.includes("claude")) return { done: 1, run: 1, wait: -1 };
    if (k.includes("render")) return { done: 2, run: 2, wait: -1 };
    return { done: 0, run: -1, wait: -1 };
  };
  const labels = ["Transkripsi", "Claude", "Render"];
  const rows = [];
  m.jobs.forEach((j) => {
    const st = stepOf(j.stage);
    rows.push(`<div class="job"><div class="jn"><b>${esc(clean(j.file))}</b><small>${esc(j.detail || j.stage)}</small></div>
      <div class="steps">${labels
        .map((l, i) => `<span class="c ${i < st.done ? "done" : i === st.run ? "run" : i === st.wait ? "wait" : ""}">${l}</span>`)
        .join("")}</div></div>`);
  });
  m.queue.forEach((n) =>
    rows.push(`<div class="job"><div class="jn"><b>${esc(clean(n))}</b><small>Menunggu giliran transkripsi</small></div>
      <div class="steps"><span class="c wait">Antre</span></div></div>`),
  );
  const sig = JSON.stringify([rows, m.clips]);
  if (sig === flowSig) return;
  flowSig = sig;
  $("flow").innerHTML = rows.length
    ? rows.join("")
    : `<div class="empty">Tidak ada video diproses. Seret video atau tempel link di bawah, atau tekan tombol demo.</div>`;
  $("flowCount").textContent = `${m.jobs.length} berjalan · ${m.queue.length} antre · ${m.clips} klip jadi`;
};

// ---------- Demo ----------
const setDemoButton = () => {
  $("btnDemo").textContent = demo ? "■ Hentikan demo" : "▶ Putar demo 3 video";
};
$("btnDemo").addEventListener("click", () => {
  demo = demo ? null : now();
  prevStages = new Map();
  primed = false;
  celebrateUntil = 0;
  errands.length = 0;
  setDemoButton();
});

// ---------- Ukuran ----------
const fit = () => {
  const w = host.clientWidth;
  const h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  const aspect = w / h;
  let hw = aspect < 1.2 ? 10.8 : 13.6; // layar sempit: bingkai lebih rapat
  let hh = hw / aspect;
  if (hh < 8.6) {
    hh = 8.6;
    hw = hh * aspect;
  }
  Object.assign(camera, { left: -hw, right: hw, top: hh, bottom: -hh });
  camera.updateProjectionMatrix();
};
new ResizeObserver(fit).observe(host);
fit();

// ---------- Loop ----------
let last = performance.now();
let model = buildModel(lastReal);
renderer.setAnimationLoop(() => {
  const t = performance.now();
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  const sec = t / 1000;

  model = buildModel(demo ? demoState() : lastReal);
  detectMoves(model);

  agents.forEach((a) => stepAgent(a, dt, model.active));
  syncCards(model);

  // layar menyala di stasiun aktif
  screenMats.forEach((arr, si) => {
    const on = model.active.has(si);
    arr.forEach((mat, k) => {
      const target = on ? 0.75 + 0.25 * Math.sin(sec * 6 + k * 1.7) : 0.05;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * 0.15;
    });
  });

  // animasi kartu
  cards.forEach((c) => {
    c.pos.lerp(c.target, Math.min(1, dt * 4));
    const bob = c.flat ? 0 : Math.sin(sec * 3 + c.pos.x) * 0.06;
    c.g.position.set(c.pos.x, c.pos.y + bob, c.pos.z);
    c.g.rotation.x = c.flat ? -Math.PI / 2 : 0;
    c.g.rotation.y = c.flat ? 0.3 : Math.PI * 0.25;
    c.g.scale.setScalar(c.flat ? 0.75 : 1);
  });
  resultCards.forEach((c) => (c.rotation.y = Math.PI * 0.25));

  controls.update();
  renderer.render(scene, camera);

  // overlay DOM
  const w = host.clientWidth;
  const h = host.clientHeight;
  camera.updateMatrixWorld();
  agents.forEach((a, i) => {
    const el = bubbleEls[i];
    const [sx, sy] = project(a.x, 2.15 - a.sit * 0.3, a.z, w, h);
    el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
    let text = "";
    if (a.say && t < a.sayUntil) text = a.say;
    else if (a.working) text = workText(a, model);
    const show = text !== "";
    el.classList.toggle("on", show);
    el.classList.toggle("mini", !show);
    el.lastChild.textContent = text;
    el.classList.toggle("busy", a.working || (a.say && t < a.sayUntil));
  });
  cards.forEach((c) => {
    if (c.flat || !c.job) {
      c.tag.style.display = "none";
      return;
    }
    const [sx, sy] = project(c.pos.x, c.pos.y + 0.7, c.pos.z, w, h);
    c.tag.style.display = "";
    c.tag.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
    c.tag.textContent = clean(c.job.file);
  });

  renderFlow(model);
});

setInterval(() => {
  const el = $("clock");
  if (el) el.textContent = new Date().toLocaleTimeString("id-ID", { hour12: false });
}, 1000);
$("notice")?.remove();
if (window.__lastState) window.updateStudio(window.__lastState);
setDemoButton();
