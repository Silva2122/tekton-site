/* Образец металла: фрагмент стены из кассет, материал меняется с выбором строки */
import * as THREE from 'three';
import gsap from 'gsap';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { studioEnvironment, brushedRoughnessTexture } from '../hero/wall.js';
import { power } from '../motion/power.js';
import { reducedMotion } from '../motion/config.js';

/* Оцинковка: «кристаллы» цинка — мозаика случайных пятен в карте шероховатости */
function spangleTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8c8c8c';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = 6 + Math.random() * 26;
    const v = 70 + Math.floor(Math.random() * 150);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    const n = 5 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.5;
      const rr = r * (0.6 + Math.random() * 0.5);
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export const METALS = [
  { color: 0xcfd2d8, metalness: 1, roughness: 0.3, env: 1.0, map: 'brushed', repeat: [1.4, 1] },  // алюминий
  { color: 0xb9bdc4, metalness: 1, roughness: 0.45, env: 0.9, map: 'spangle', repeat: [1, 1.3] }, // оцинкованная сталь
  { color: 0xdfe2e6, metalness: 1, roughness: 0.18, env: 1.2, map: 'brushed', repeat: [2.2, 1] }, // нержавеющая сталь
  { color: 0xb46a3c, metalness: 1, roughness: 0.36, env: 1.0, map: 'brushed', repeat: [1.2, 1] }, // медь
];

export function createMetalStage(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, ...power.gl });
  } catch {
    return null;
  }
  renderer.setPixelRatio(power.dpr());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioEnvironment(), 0.02).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(1.0, -0.5, 6.6);
  camera.lookAt(0.2, 0.2, 0);

  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(-4, 5, 6);
  const rim = new THREE.DirectionalLight(0x5768e5, 0.6);
  rim.position.set(5, -2, 3);
  scene.add(key, rim, new THREE.HemisphereLight(0x55586a, 0x000000, 0.7));

  const maps = { brushed: brushedRoughnessTexture(), spangle: spangleTexture() };
  const mat = new THREE.MeshStandardMaterial({ color: METALS[0].color, metalness: 1, roughness: METALS[0].roughness, roughnessMap: maps.brushed, envMapIntensity: METALS[0].env });

  // Фрагмент стены 3×4, с лёгким наклоном
  const W = 1.6, H = 1.0, D = 0.07, G = 0.05;
  const geo = new RoundedBoxGeometry(W, H, D, 2, 0.012);
  const cols = 3, rows = 4;
  const mesh = new THREE.InstancedMesh(geo, mat, cols * rows);
  const d = new THREE.Object3D();
  let i = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    d.position.set((c - 1) * (W + G), (r - 1.5) * (H + G), 0);
    d.updateMatrix();
    mesh.setMatrixAt(i++, d.matrix);
  }
  const group = new THREE.Group();
  group.add(mesh);
  group.rotation.set(0.08, -0.5, 0.04);
  scene.add(group);

  let running = false;
  const timer = new THREE.Timer();
  const reduced = reducedMotion();
  const skip = power.throttle();
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

  function frame() {
    if (!running) return;
    if (skip()) { requestAnimationFrame(frame); return; }
    timer.update();
    const t = timer.getElapsed();
    parallax.x += (parallax.tx - parallax.x) * 0.05;
    parallax.y += (parallax.ty - parallax.y) * 0.05;
    group.rotation.y = -0.5 + parallax.x * 0.25 + (reduced ? 0 : Math.sin(t * 0.25) * 0.06);
    group.rotation.x = 0.08 - parallax.y * 0.15;
    key.position.set(-4 + Math.sin(t * 0.3) * 5, 5, 6); // блик медленно проезжает по образцу
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function setMetal(idx) {
    const m = METALS[idx];
    const c = new THREE.Color(m.color);
    gsap.to(mat.color, { r: c.r, g: c.g, b: c.b, duration: 0.7, ease: 'power2.out' });
    gsap.to(mat, { roughness: m.roughness, envMapIntensity: m.env, duration: 0.7, ease: 'power2.out' });
    const tex = maps[m.map];
    tex.repeat.set(m.repeat[0], m.repeat[1]);
    mat.roughnessMap = tex;
    mat.needsUpdate = true;
  }

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  if (window.matchMedia('(hover: hover)').matches) {
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      parallax.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      parallax.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    }, { passive: true });
    canvas.addEventListener('pointerleave', () => { parallax.tx = 0; parallax.ty = 0; });
  }

  const api = {
    start() { if (running) return; running = true; timer.reset(); requestAnimationFrame(frame); },
    stop() { running = false; },
    setMetal,
  };
  power.register({ isRunning: () => running, start: api.start, stop: api.stop });
  return api;
}
