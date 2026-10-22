/*
 * Фрагмент здания из кассет: угол фасада с окнами, снизу вверх, под небом.
 * Перекраска — второй слой кассет, который проявляется поверх первого.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { motion } from '../motion/config.js';
import { power } from '../motion/power.js';

const CASS = { w: 1.2, h: 0.6, d: 0.03, gap: 0.02 };

/* Небо с лёгкой дымкой у горизонта */
function skyEnvironment() {
  const env = new THREE.Scene();
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#5f86c7');
  grd.addColorStop(0.55, '#b9cbe6');
  grd.addColorStop(1, '#e7e4df');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }));
  env.add(dome);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  sun.material.color.multiplyScalar(14);
  sun.position.set(-20, 28, 30);
  env.add(sun);
  return env;
}

export function createFacade(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, ...power.gl });
  } catch {
    return null;
  }
  renderer.setPixelRatio(power.dpr());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(skyEnvironment(), 0.03).texture;
  scene.environment = envTex;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(-10, 16, 14);
  scene.add(sun, new THREE.HemisphereLight(0xcfdcf0, 0x2a2a2e, 0.55));

  const building = new THREE.Group();
  scene.add(building);

  const geo = new RoundedBoxGeometry(CASS.w, CASS.h, CASS.d, 2, 0.006);

  // Один слой кассет. Перекраска — смешивание двух покрытий внутри шейдера,
  // без второго меша поверх первого (иначе кромки мерцают от z-fighting).
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.colorSpace = THREE.SRGBColorSpace;
  white.needsUpdate = true;
  const mix = {
    uMix: { value: 0 },
    uColorB: { value: new THREE.Color(0xbec2c8) },
    uMapB: { value: white },
    uMetalB: { value: 0.3 },
    uRoughB: { value: 0.45 },
  };
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xbec2c8, map: white, metalness: 0.3, roughness: 0.45, envMapIntensity: 0.9 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mix);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uMix; uniform vec3 uColorB; uniform sampler2D uMapB; uniform float uMetalB; uniform float uRoughB;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  vec3 colB = uColorB * texture2D(uMapB, vMapUv).rgb;\n  diffuseColor.rgb = mix(diffuseColor.rgb, colB, uMix);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, uRoughB, uMix);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, uMetalB, uMix);');
  };

  const glass = new THREE.MeshPhysicalMaterial({ color: 0x1c2a3a, metalness: 0.9, roughness: 0.08, envMapIntensity: 1.3 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.6, roughness: 0.5 });

  // Две стены под углом, окна вырезаны из сетки кассет
  const cols = 9, rows = 14;
  const stepX = CASS.w + CASS.gap, stepY = CASS.h + CASS.gap;
  const isWindow = (c, r) => (r % 3 === 1 || r % 3 === 2) && (c % 3 === 1);
  const cells = [];
  const wins = [];
  const walls = [
    { rotY: 0, origin: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(-1, 0, 0) },
    { rotY: Math.PI / 2 + 0.05, origin: new THREE.Vector3(0.02, 0, 0), dir: new THREE.Vector3(0, 0, -1) },
  ];
  const d = new THREE.Object3D();
  for (const wall of walls) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const pos = wall.origin.clone().add(wall.dir.clone().multiplyScalar((c + 0.5) * stepX));
      pos.y = r * stepY;
      (isWindow(c, r) ? wins : cells).push({ pos, rotY: wall.rotY });
    }
  }
  // Окна: стекло в глубине и рама, два инстанс-меша на все окна
  const glassMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CASS.w - 0.1, CASS.h - 0.06, 0.02), glass, wins.length);
  const frameMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CASS.w, CASS.h, 0.12), frame, wins.length);
  wins.forEach((w, i) => {
    const back = new THREE.Vector3(Math.sin(w.rotY), 0, Math.cos(w.rotY)).multiplyScalar(-0.12);
    d.rotation.set(0, w.rotY, 0);
    d.position.copy(w.pos).add(back); d.updateMatrix(); glassMesh.setMatrixAt(i, d.matrix);
    d.position.copy(w.pos).add(back.clone().multiplyScalar(0.5)); d.updateMatrix(); frameMesh.setMatrixAt(i, d.matrix);
  });
  building.add(glassMesh, frameMesh);
  const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
  cells.forEach((cell, i) => {
    d.position.copy(cell.pos);
    d.rotation.set(0, cell.rotY, 0);
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
  });
  building.add(mesh);
  // Угловой профиль
  const corner = new THREE.Mesh(new THREE.BoxGeometry(0.05, rows * stepY, 0.05), frame);
  corner.position.set(0.015, (rows * stepY) / 2 - CASS.h / 2, 0.015);
  building.add(corner);

  const look = new THREE.Vector3(-1.2, 3.6, -1.0);
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  let running = false;
  let scrollP = 0;
  let pending = null;

  const loader = new THREE.TextureLoader();
  const texCache = new Map();
  const loadMap = (src) => {
    if (!src) return Promise.resolve(null);
    if (texCache.has(src)) return Promise.resolve(texCache.get(src));
    return new Promise((res) => loader.load(src, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, 0.6);
      texCache.set(src, t);
      res(t);
    }, undefined, () => res(null)));
  };

  // Покрытие B зафиксировать как текущее, чтобы следующий переход начинался с него
  function commit() {
    mat.color.copy(mix.uColorB.value);
    mat.map = mix.uMapB.value;
    mat.metalness = mix.uMetalB.value;
    mat.roughness = mix.uRoughB.value;
    mat.needsUpdate = true;
    mix.uMix.value = 0;
  }

  async function setFinish(finish) {
    const { hex, map, metalness = 0.3, roughness = 0.45, iridescence = 0 } = finish;
    pending = finish;
    const tex = map ? await loadMap(map) : null;
    if (pending !== finish) return; // успели выбрать другой цвет
    gsap.killTweensOf(mix.uMix);
    if (mix.uMix.value > 0) commit();
    mix.uColorB.value.set(tex ? 0xffffff : hex);
    mix.uMapB.value = tex || white;
    mix.uMetalB.value = metalness;
    mix.uRoughB.value = roughness;
    mat.iridescence = iridescence;
    gsap.to(mix.uMix, { value: 1, duration: motion.colors.fade, ease: 'power2.inOut', onComplete: commit });
  }

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 760 ? 48 : 34;
    camera.updateProjectionMatrix();
  }

  const timer = new THREE.Timer();
  const skip = power.throttle();
  function tick() {
    if (!running) return;
    if (skip()) { requestAnimationFrame(tick); return; }
    timer.update();
    const p = motion.colors.parallax;
    parallax.x += (parallax.tx - parallax.x) * 0.05;
    parallax.y += (parallax.ty - parallax.y) * 0.05;
    camera.position.set(3.4 + parallax.x * p, -0.6 + parallax.y * p + scrollP * 1.2, 5.2);
    camera.lookAt(look.x, look.y + scrollP * 1.6, look.z);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  const onMove = (e) => {
    parallax.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    parallax.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
  };
  if (window.matchMedia('(hover: hover)').matches) window.addEventListener('pointermove', onMove, { passive: true });

  new ResizeObserver(resize).observe(canvas);
  resize();

  const api = {
    start() { if (running) return; running = true; timer.reset(); requestAnimationFrame(tick); },
    stop() { running = false; },
    setFinish,
    setScroll(p) { scrollP = p; },
  };
  power.register({ isRunning: () => running, start: api.start, stop: api.stop });
  return api;
}
