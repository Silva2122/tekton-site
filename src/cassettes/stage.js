/* Сцена с живой кассетой: вращение от курсора, смена типа и цвета */
import * as THREE from 'three';
import gsap from 'gsap';
import { studioEnvironment } from '../hero/wall.js';
import { buildCassette, TYPES } from './cassette.js';
import { reducedMotion } from '../motion/config.js';
import { power } from '../motion/power.js';

export function createCassetteStage(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, ...power.gl });
  } catch {
    return null;
  }
  renderer.setPixelRatio(power.dpr());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioEnvironment(), 0.02).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 200, 8000);
  camera.position.set(0, 100, 2050);
  camera.lookAt(0, 0, 0);

  const key = new THREE.DirectionalLight(0xffffff, 2.8);
  key.position.set(-700, 1200, 2200);
  const fill = new THREE.DirectionalLight(0xdfe6ff, 1.1);
  fill.position.set(1600, 300, 1200);
  const rim = new THREE.DirectionalLight(0x5768e5, 0.8);
  rim.position.set(1400, -400, -800);
  const back = new THREE.DirectionalLight(0xffffff, 1.3);
  back.position.set(-600, 500, -2000);
  scene.add(key, fill, rim, back, new THREE.HemisphereLight(0x55586a, 0x000000, 0.9));

  const paint = new THREE.MeshPhysicalMaterial({ color: 0x9fa1ae, metalness: 0.35, roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 1.6 });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xb9bcc4, metalness: 1, roughness: 0.3, envMapIntensity: 1.2 });

  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  pivot.add(spin);
  scene.add(pivot);
  let current = null;
  let typeIdx = 0;
  const rot = { x: 0.14, y: -0.85, tx: 0.14, ty: -0.85 };
  let running = false;
  let fit = 1;
  const timer = new THREE.Timer();
  const reduced = reducedMotion();

  function mount(idx) {
    const t = TYPES[idx];
    const g = buildCassette(t, paint, steel);
    // Нормируем размер: самая большая сторона всегда одинаковой высоты в кадре
    const s = 880 / Math.max(t.w, t.h);
    g.scale.setScalar(s * fit);
    g.userData.base = s;
    return g;
  }

  // Переключение типа: кассета поворачивается ребром, подменяется и доворачивается
  // через тыльную сторону, показывая узел крепления. На экране всегда одна модель.
  let busy = false, queued = null;
  function setType(idx, animate = true) {
    if (idx === typeIdx && current) return;
    if (busy) { queued = idx; return; }
    const swap = () => {
      if (current) spin.remove(current);
      current = mount(idx);
      typeIdx = idx;
      spin.add(current);
    };
    if (!animate || reduced) { swap(); return; }
    busy = true;
    gsap.to(spin.rotation, { y: -Math.PI / 2, duration: 0.32, ease: 'power2.in', onComplete: () => {
      swap();
      gsap.to(spin.rotation, { y: -Math.PI * 2, duration: 1.1, ease: 'power3.out', onComplete: () => {
        spin.rotation.y = 0;
        busy = false;
        if (queued !== null) { const q = queued; queued = null; setType(q); }
      } });
    } });
  }

  function setColor(hex, params = {}) {
    const c = new THREE.Color(hex);
    gsap.to(paint.color, { r: c.r, g: c.g, b: c.b, duration: 0.6, ease: 'power2.out' });
    gsap.to(paint, { metalness: params.metalness ?? 0.35, roughness: params.roughness ?? 0.4, duration: 0.6 });
    paint.iridescence = params.iridescence ?? 0;
  }

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fit = w < 760 ? 0.95 : Math.min(1, h / 820);
    if (current) current.scale.setScalar(current.userData.base * fit);
  }

  const skip = power.throttle();
  function frame() {
    if (!running) return;
    if (skip()) { requestAnimationFrame(frame); return; }
    timer.update();
    const t = timer.getElapsed();
    rot.x += (rot.tx - rot.x) * 0.06;
    rot.y += (rot.ty - rot.y) * 0.06;
    pivot.rotation.set(rot.x, rot.y + (reduced ? 0 : Math.sin(t * 0.3) * 0.2), 0);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    rot.ty = -0.85 + ((e.clientX - r.left) / r.width - 0.5) * 1.6;
    rot.tx = 0.12 + ((e.clientY - r.top) / r.height - 0.5) * 0.5;
  };
  if (window.matchMedia('(hover: hover)').matches) canvas.addEventListener('pointermove', onMove, { passive: true });

  new ResizeObserver(resize).observe(canvas);
  resize();
  setType(0, false);

  const api = {
    start() { if (running) return; running = true; timer.reset(); requestAnimationFrame(frame); },
    stop() { running = false; },
    setType,
    setColor,
  };
  power.register({ isRunning: () => running, start: api.start, stop: api.stop });
  return api;
}
