/*
 * Стена фасадных кассет на первом экране.
 * Металлические кассеты собираются в фасад из глубины кадра; одна кассета
 * индиго несёт знак «Тектон» — та же идея, что заложена в логотипе.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';
import { motion, reducedMotion } from '../motion/config.js';
import { power } from '../motion/power.js';

const CASSETTE = { w: 1.6, h: 1.0, d: 0.07, gap: 0.05 };

const VIEW = {
  desktop: { cols: 30, rows: 22, shift: [5.0, 4.2], pos: [-2.0, -3.4, 6.6], target: [1.6, 1.6, 0], roll: 0.07, fov: 40, signCell: [14, 8] },
  mobile:  { cols: 16, rows: 26, shift: [2.4, 4.0], pos: [-0.6, -5.5, 8.2], target: [0.8, 2.4, 0], roll: 0.04, fov: 52, signCell: [7, 12] },
};

const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4);
// ?static — сразу собранная стена; ?t=1.2 — стоп-кадр сборки на секунде 1.2 (отладка)
const PARAMS = new URLSearchParams(location.search);
const STATIC = PARAMS.has('static');
const FREEZE_AT = PARAMS.has('t') ? parseFloat(PARAMS.get('t')) : null;

// Фактура шлифованного металла: горизонтальные штрихи в карте шероховатости.
export function brushedRoughnessTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const y = Math.random() * size;
    const len = 40 + Math.random() * 300;
    const x = Math.random() * size;
    const v = 120 + Math.floor(Math.random() * 90);
    ctx.strokeStyle = `rgba(${v},${v},${v},${0.15 + Math.random() * 0.35})`;
    ctx.lineWidth = Math.random() < 0.8 ? 1 : 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (Math.random() - 0.5) * 0.6);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 1);
  return tex;
}

// Студийное окружение для отражений: тёмная комната, длинный световой короб
// сверху и индиго-панель снизу. Даёт металлу читаемый блик с горизонтом.
export function studioEnvironment() {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(30, 30, 30),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0c, side: THREE.BackSide, roughness: 1, metalness: 0 })
  );
  env.add(room);
  const panel = (w, h, color, intensity, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }));
    m.material.color.multiplyScalar(intensity);
    m.position.set(...pos);
    m.rotation.set(...rot);
    env.add(m);
  };
  panel(26, 4, 0xffffff, 6.5, [0, 9, -6], [0.55, 0, 0]);       // верхний световой короб
  panel(10, 14, 0xdfe3ea, 2.2, [13, 2, 2], [0, -1.2, 0]);     // мягкая стена справа
  panel(8, 10, 0xcfd2d8, 1.1, [-13, 0, 4], [0, 1.1, 0]);      // слабое заполнение слева
  panel(20, 3, 0x5768e5, 1.6, [0, -9, -2], [-0.7, 0, 0]);     // индиго снизу
  return env;
}

function loadSignTexture(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 512;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, 0, 0, size, size);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      resolve(tex);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function createWall(canvas, { onReady } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, ...power.gl });
  } catch {
    return null;
  }
  renderer.setPixelRatio(power.dpr());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 9, 24);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioEnvironment(), 0.02).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);

  // Свет: холодный ключевой, который медленно проезжает по фасаду, и тёплый контровой
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(-6, 7, 9);
  const rim = new THREE.DirectionalLight(0x5768e5, 1.1);
  rim.position.set(9, -3, 5);
  const fill = new THREE.HemisphereLight(0x474a57, 0x000000, 0.55);
  scene.add(key, rim, fill);

  const metal = new THREE.MeshStandardMaterial({
    color: 0xb4b7bf,
    metalness: 1,
    roughness: 0.24,
    roughnessMap: brushedRoughnessTexture(),
    envMapIntensity: 1.35,
  });
  const indigo = new THREE.MeshStandardMaterial({
    color: 0x5768e5,
    emissive: 0x5768e5,
    emissiveIntensity: 0.32,
    metalness: 0.1,
    roughness: 0.55,
    envMapIntensity: 0.35,
  });

  const geo = new RoundedBoxGeometry(CASSETTE.w, CASSETTE.h, CASSETTE.d, 2, 0.012);
  const group = new THREE.Group();
  scene.add(group);

  let view = VIEW.desktop;
  let mesh, sign, signPlate;
  let cells = [];
  let assemble = { t: 0, total: 1 };
  const dummy = new THREE.Object3D();
  const basePos = new THREE.Vector3();
  const target = new THREE.Vector3();
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollP = 0;
  let held = false; // сборка стены ждёт, пока уйдёт прелоадер
  let parked = false; // цикл кадров остановлен под прелоадером
  let running = false;
  let ready = false;
  let signTex = null;

  function build() {
    if (mesh) { group.remove(mesh); mesh.dispose(); }
    if (signPlate) { group.remove(signPlate); }
    if (sign) { group.remove(sign); }

    const { cols, rows, signCell } = view;
    const stepX = CASSETTE.w + CASSETTE.gap;
    const stepY = CASSETTE.h + CASSETTE.gap;
    const ox = -((cols - 1) * stepX) / 2 + view.shift[0];
    const oy = -((rows - 1) * stepY) / 2 + view.shift[1];

    cells = [];
    const count = cols * rows - 1;
    mesh = new THREE.InstancedMesh(geo, metal, count);
    mesh.frustumCulled = false;

    const a = motion.hero.assemble;
    const sx = ox + signCell[0] * stepX;
    const sy = oy + signCell[1] * stepY;
    let maxDist = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ox + c * stepX;
        const y = oy + r * stepY;
        const isSign = c === signCell[0] && r === signCell[1];
        const dist = Math.hypot(x - sx, y - sy);
        maxDist = Math.max(maxDist, dist);
        cells.push({
          x, y, isSign, dist,
          startZ: -(a.spreadZ * (0.5 + Math.random() * 0.5)),
          jx: (Math.random() - 0.5) * a.spreadXY,
          jy: (Math.random() - 0.5) * a.spreadXY,
          rx: (Math.random() - 0.5) * a.tilt,
          ry: (Math.random() - 0.5) * a.tilt,
          delay: 0,
        });
      }
    }
    const spread = a.stagger * Math.sqrt(cells.length) * 2.2;
    for (const cell of cells) cell.delay = (cell.dist / maxDist) * spread;
    assemble.total = spread + a.duration;

    // Кассета со знаком: отдельный меш, чтобы у неё был свой материал и знак на лицевой стороне
    signPlate = new THREE.Mesh(geo, indigo);
    signPlate.position.set(sx, sy, 0);
    group.add(signPlate);

    const signSize = CASSETTE.h * 0.58;
    sign = new THREE.Mesh(
      new THREE.PlaneGeometry(signSize, signSize),
      new THREE.MeshBasicMaterial({ map: signTex, transparent: true, depthWrite: false, toneMapped: false, fog: false })
    );
    sign.position.set(sx, sy, CASSETTE.d / 2 + 0.003);
    sign.visible = !!signTex;
    group.add(sign);

    group.add(mesh);
    if (reducedMotion() || STATIC) assemble.t = assemble.total;
    if (FREEZE_AT !== null) assemble.t = FREEZE_AT;
    updateInstances(assemble.t);
  }

  function updateInstances(t) {
    const a = motion.hero.assemble;
    let i = 0;
    for (const cell of cells) {
      const k = easeOutQuart(THREE.MathUtils.clamp((t - cell.delay) / a.duration, 0, 1));
      const inv = 1 - k;
      if (cell.isSign) {
        signPlate.position.set(cell.x + cell.jx * inv, cell.y + cell.jy * inv, cell.startZ * inv);
        signPlate.rotation.set(cell.rx * inv, cell.ry * inv, 0);
        sign.position.set(signPlate.position.x, signPlate.position.y, signPlate.position.z + CASSETTE.d / 2 + 0.003);
        sign.rotation.copy(signPlate.rotation);
        continue;
      }
      dummy.position.set(cell.x + cell.jx * inv, cell.y + cell.jy * inv, cell.startZ * inv);
      dummy.rotation.set(cell.rx * inv, cell.ry * inv, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  let lastW = 0, lastH = 0;
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const next = w < 760 ? VIEW.mobile : VIEW.desktop;
    camera.fov = next.fov;
    camera.updateProjectionMatrix();
    if (next !== view || !mesh) {
      view = next;
      build();
    }
  }

  const timer = new THREE.Timer();
  const skip = power.throttle();
  function frame() {
    if (!running) return;
    if (skip()) { requestAnimationFrame(frame); return; }
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    const elapsed = timer.getElapsed();

    if (held) { renderer.clear(); if (!ready) { ready = true; onReady?.(); } parked = true; return; } // под прелоадером чёрный кадр, дальше ждём release()
    if (!held && assemble.t < assemble.total && FREEZE_AT === null) {
      assemble.t = Math.min(assemble.t + dt, assemble.total);
      updateInstances(assemble.t);
    }

    const p = motion.hero.parallax;
    parallax.x += (parallax.tx - parallax.x) * p.lerp;
    parallax.y += (parallax.ty - parallax.y) * p.lerp;

    const s = motion.hero.scroll;
    const d = motion.hero.drift;
    const driftX = Math.sin(elapsed / d.period * Math.PI * 2) * d.amp;
    const driftY = Math.cos(elapsed / d.period * Math.PI * 2 * 0.7) * d.amp * 0.6;
    basePos.set(
      view.pos[0] + parallax.x * p.x + driftX,
      view.pos[1] + parallax.y * p.y + driftY - scrollP * s.drop,
      view.pos[2] + scrollP * s.depth
    );
    target.set(view.target[0], view.target[1] - scrollP * s.drop * 0.6, view.target[2]);
    camera.position.copy(basePos);
    camera.lookAt(target);
    camera.rotateZ(view.roll);

    const L = motion.hero.light;
    const ph = (elapsed / L.period) * Math.PI * 2;
    key.position.set(-6 + Math.sin(ph) * 9, 7 + Math.cos(ph * 0.5) * 1.5, 9);

    renderer.render(scene, camera);

    if (!ready) {
      ready = true;
      onReady?.();
    }
    requestAnimationFrame(frame);
  }

  function start() {
    if (held && parked) return; // под прелоадером цикл поднимет release()
    if (running) return;
    running = true;
    timer.reset();
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }
  power.register({ isRunning: () => running, start, stop });

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const onPointer = (e) => {
    parallax.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    parallax.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
  };
  if (window.matchMedia('(hover: hover)').matches) {
    window.addEventListener('pointermove', onPointer, { passive: true });
  }

  loadSignTexture('brand/tekton-sign-white.svg').then((tex) => {
    signTex = tex;
    if (sign && tex) {
      sign.material.map = tex;
      sign.material.needsUpdate = true;
      sign.visible = true;
    }
  });

  resize();
  start();

  return {
    start,
    stop,
    setScroll(p) { scrollP = THREE.MathUtils.clamp(p, 0, 1); },
    hold() { held = true; },
    release() { held = false; timer.reset(); power.wake(3000); if (parked) { parked = false; running = true; requestAnimationFrame(frame); } },
    dispose() {
      stop();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      renderer.dispose();
    },
  };
}
