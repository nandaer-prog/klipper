/* global document, window, matchMedia, devicePixelRatio, ResizeObserver */
// Kantor 3D isometrik untuk dashboard Clipper.
// Lima meja: Antrean & Unduh -> Transkripsi -> Claude Editor -> Render -> Hasil Klip.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const host = document.getElementById("office");

const STATIONS = [
  { name: "Antrean & Unduh", color: 0xf59e0b },
  { name: "Transkripsi", color: 0x14b8a6 },
  { name: "Claude Editor", color: 0x8b5cf6 },
  { name: "Render", color: 0xef4444 },
  { name: "Hasil Klip", color: 0x22c55e },
];
const XS = [-7.2, -3.6, 0, 3.6, 7.2];
const speed = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.25 : 1;
const css = (hex) => "#" + hex.toString(16).padStart(6, "0");

// ---------- Renderer, kamera, cahaya ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camera.position.set(10, 12, 10);
camera.lookAt(0, 0.6, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minZoom = 0.7;
controls.maxZoom = 2.2;
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 1.3;
controls.minAzimuthAngle = Math.PI / 4 - 0.6;
controls.maxAzimuthAngle = Math.PI / 4 + 0.6;
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd8e6, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(8, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 1, far: 40 });
sun.shadow.bias = -0.0005;
scene.add(sun);

// ---------- Helper ----------
const office = new THREE.Group();
office.rotation.y = Math.PI / 4; // sumbu X lokal jadi horizontal di layar
scene.add(office);

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...extra });

const box = (w, h, d, material, x, y, z, parent = office) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
};

// ---------- Lantai ----------
box(19.4, 0.5, 5.8, mat(0xd9e0ea), 0, -0.55, 0.55);
box(18.8, 0.3, 5.2, mat(0xf4f6fa), 0, -0.15, 0.55);
{
  const pts = [];
  for (let x = -9.4; x <= 9.41; x += 1) pts.push(x, 0.01, -2.05, x, 0.01, 3.15);
  for (let z = -2.05; z <= 3.16; z += 1) pts.push(-9.4, 0.01, z, 9.4, 0.01, z);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  office.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xe0e6ef })));
}

// ---------- Label papan nama ----------
const makeLabel = (color) => {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 220;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(3.3, 1.13, 1);
  sprite.renderOrder = 10;
  let last = "";
  const draw = (title, sub, active) => {
    const key = title + "|" + sub + "|" + active;
    if (key === last) return;
    last = key;
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, 640, 220);
    c.fillStyle = "rgba(255,255,255,0.96)";
    c.strokeStyle = active ? css(color) : "#d5dbe5";
    c.lineWidth = active ? 8 : 4;
    c.beginPath();
    c.roundRect(10, 10, 620, 200, 28);
    c.fill();
    c.stroke();
    c.textAlign = "center";
    c.fillStyle = "#18202d";
    c.font = "bold 58px ui-monospace, Menlo, Consolas, monospace";
    c.fillText(title, 320, 98);
    c.fillStyle = active ? css(color) : "#667085";
    c.font = "40px ui-monospace, Menlo, Consolas, monospace";
    c.fillText(sub, 320, 164);
    tex.needsUpdate = true;
  };
  return { sprite, draw };
};

// ---------- Meja kerja + karakter ----------
const stations = STATIONS.map((st, i) => {
  const g = new THREE.Group();
  g.position.set(XS[i], 0, 0);
  office.add(g);

  box(2.4, 0.9, 1.2, mat(0xffffff), 0, 0.45, 0, g);
  box(2.5, 0.1, 1.3, mat(st.color), 0, 0.95, 0, g);
  box(0.12, 0.35, 0.12, mat(0x9aa4b2), -0.5, 1.2, -0.2, g);
  const screen = box(
    1.1, 0.7, 0.07,
    new THREE.MeshStandardMaterial({ color: 0x1f2937, emissive: st.color, emissiveIntensity: 0, roughness: 0.4 }),
    -0.5, 1.75, -0.2, g,
  );

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.9, 20), mat(st.color));
  body.position.set(0.55, 0.45, -1.05);
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 24), mat(0xf2c9a5));
  head.position.set(0.55, 1.17, -1.05);
  head.castShadow = true;
  g.add(head);

  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.55 + side * 0.4, 0.95, -1.0);
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), mat(st.color));
    a.position.y = -0.25;
    a.castShadow = true;
    pivot.add(a);
    g.add(pivot);
    return pivot;
  };
  const armL = arm(-1);
  const armR = arm(1);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.045, 12, 40),
    new THREE.MeshStandardMaterial({ color: st.color, emissive: st.color, emissiveIntensity: 0.6 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0.55, 1.75, -1.05);
  ring.visible = false;
  g.add(ring);

  const label = makeLabel(st.color);
  label.sprite.position.set(0, 0.55, 1.55);
  g.add(label.sprite);

  return { g, screen, head, armL, armR, ring, label, phase: i * 1.7 };
});

// ---------- Kartu video yang berpindah ----------
const job = new THREE.Group();
{
  const card = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.05, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x1d4ed8, emissiveIntensity: 0.4, roughness: 0.35 }),
  );
  card.castShadow = true;
  job.add(card);
  const tri = new THREE.Shape();
  tri.moveTo(-0.08, -0.12);
  tri.lineTo(-0.08, 0.12);
  tri.lineTo(0.12, 0);
  const play = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  play.position.z = 0.051;
  job.add(play);
}
job.position.set(XS[0], 2.9, 0.3);
job.scale.setScalar(0.001);
job.visible = false;
office.add(job);

// ---------- Tumpukan berkas (antrean) dan kartu hasil ----------
const queuePile = [];
const resultPile = [];
const palette = [0x2563eb, 0x7c3aed, 0x0891b2, 0xdb2777, 0xea580c, 0x16a34a];

const syncPile = (pile, count, make) => {
  while (pile.length < count) pile.push(make(pile.length));
  while (pile.length > count) {
    const m = pile.pop();
    m.parent.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  }
};

const makeDoc = (i) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.07, 0.55), mat(0xffffff));
  m.position.set(0.55, 1.03 + i * 0.075, 0.1);
  m.rotation.y = ((i * 37) % 11) * 0.03 - 0.15;
  m.castShadow = true;
  m.receiveShadow = true;
  stations[0].g.add(m);
  return m;
};
const makeResult = (i) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.06), mat(palette[i % palette.length]));
  m.position.set(-0.95 + (i % 8) * 0.27, 1.3, 0.25 - Math.floor(i / 8) * 0.3);
  m.castShadow = true;
  stations[4].g.add(m);
  return m;
};

// ---------- Status dari dashboard ----------
let active = -1;
const short = (s, n = 24) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const updateOffice = (s) => {
  const downloading = (s.downloads || []).find((d) => d.status === "mengunduh");
  const stage = s.status ? (s.status.stage || "").toLowerCase() : "";
  let detail = "";

  active = -1;
  if (s.status) {
    active = stage.includes("transkrip") ? 1 : stage.includes("claude") ? 2 : stage.includes("render") ? 3 : -1;
    detail = s.status.detail || s.status.file || "";
  } else if (downloading) {
    active = 0;
    detail = `Mengunduh ${Math.round(downloading.progress)}%`;
  }

  const queued = (s.queue || []).filter((q) => !s.status || q.name !== s.status.file).length;
  const clips = (s.results || []).reduce((n, r) => n + r.clips.length, 0);
  const videos = (s.results || []).length;

  const subs = [
    active === 0 ? detail : queued ? `${queued} video menunggu` : "Kosong",
    active === 1 ? short(s.status.file) : "Siap",
    active === 2 ? short(s.status.file) : "Siap",
    active === 3 ? short(detail || "Merender") : "Siap",
    clips ? `${clips} klip / ${videos} video` : "Belum ada hasil",
  ];
  STATIONS.forEach((st, i) => stations[i].label.draw(st.name, short(subs[i], 26), i === active));

  syncPile(queuePile, Math.min(queued + (s.status ? 1 : 0), 10), makeDoc);
  syncPile(resultPile, Math.min(clips, 16), makeResult);
};
window.updateOffice = updateOffice;

// ---------- Ukuran ----------
const fit = () => {
  const w = host.clientWidth;
  const h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  const aspect = w / h;
  let hw = 9.9;
  let hh = hw / aspect;
  if (hh < 3.7) {
    hh = 3.7;
    hw = hh * aspect;
  }
  Object.assign(camera, { left: -hw, right: hw, top: hh, bottom: -hh });
  camera.updateProjectionMatrix();
};
new ResizeObserver(fit).observe(host);
fit();

// ---------- Animasi ----------
const clock = new THREE.Clock();
const target = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime() * speed;

  stations.forEach((st, i) => {
    const on = i === active;
    const m = st.screen.material;
    m.emissiveIntensity += ((on ? 0.85 + 0.2 * Math.sin(t * 6) : 0.04) - m.emissiveIntensity) * 0.12;
    st.ring.visible = on;
    st.ring.rotation.z = t * 2.2;
    st.head.position.y = 1.17 + (on ? 0.045 * Math.sin(t * 8) : 0.012 * Math.sin(t * 1.5 + st.phase));
    st.armL.rotation.x = on ? -1.1 + 0.4 * Math.sin(t * 11) : -0.15;
    st.armR.rotation.x = on ? -1.1 + 0.4 * Math.sin(t * 11 + Math.PI) : -0.15;
  });

  if (active >= 0) {
    job.visible = true;
    target.set(XS[active], 2.95 + 0.12 * Math.sin(t * 3), 0.3);
    job.position.lerp(target, 0.08);
    job.scale.lerp(new THREE.Vector3(1, 1, 1), 0.12);
    job.rotation.y = 0.35 * Math.sin(t * 1.5);
  } else {
    job.scale.lerp(new THREE.Vector3(0.001, 0.001, 0.001), 0.15);
    if (job.scale.x < 0.02) job.visible = false;
  }

  controls.update();
  renderer.render(scene, camera);
});

document.getElementById("officeNote")?.remove();
if (window.__lastState) updateOffice(window.__lastState);
