/*
 * Спираль объектов: фасады натянуты на винтовую ленту, которая бесконечно
 * вращается. При скролле лента разворачивается из наклонной позы в «стену».
 * Единицы сцены равны пикселям экрана: камера стоит далеко с узким углом.
 */
import * as THREE from 'three';
import { motion, reducedMotion } from '../motion/config.js';
import { power } from '../motion/power.js';

const VERT = /* glsl */ `
uniform float uS0, uWidth, uTravel, uLoop, uRadius, uPitch, uRibbon, uTop, uFade, uHeight;
uniform float uHoverY, uHoverAmp, uHoverSigma;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPos;
varying float vAlpha;
const float TAU = 6.28318530718;
void main() {
  float sBase = mod(uS0 + uTravel, uLoop);
  float s = sBase + uv.x * uWidth;
  float theta = s / uRadius;
  float axisY = uTop - theta / TAU * uPitch;
  // наведение: соседние витки расходятся вокруг курсора
  axisY += uHoverAmp * uHoverSigma * tanh((axisY - uHoverY) / uHoverSigma);
  float y = axisY + (uv.y - 0.5) * uRibbon;
  vec3 p = vec3(sin(theta) * uRadius, y, cos(theta) * uRadius);
  vec3 n = vec3(sin(theta), 0.0, cos(theta));
  vNormal = normalize(normalMatrix * n);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vPos = mv.xyz;
  float yBottom = uTop - uHeight;
  vAlpha = smoothstep(yBottom, yBottom + uFade, axisY) * (1.0 - smoothstep(uTop - uFade, uTop, axisY));
  vUv = uv;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uSide, uBack;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPos;
varying float vAlpha;
void main() {
  vec4 c = texture2D(map, vUv);
  float facing = dot(normalize(vNormal), normalize(-vPos));
  vec3 front = c.rgb * (1.0 - uSide * (1.0 - max(0.0, facing)));
  vec3 back = c.rgb * (1.0 - uBack);
  vec3 col = gl_FrontFacing ? front : back;
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(col, vAlpha);
  #include <colorspace_fragment>
}`;

const lerp = (a, b, t) => a + (b - a) * t;

export function createSpiral(canvas, covers) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, ...power.gl });
  } catch {
    return null;
  }
  renderer.setPixelRatio(power.dpr());
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const cfg = motion.spiral;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 1, 100, 20000);
  camera.position.set(0, 0, cfg.perspective);

  const group = new THREE.Group();
  scene.add(group);

  // Лента: обложки повторяются, чтобы спираль была в несколько витков
  const repeats = cfg.repeats;
  const step = cfg.cardW + cfg.gap;
  const loop = covers.length * repeats * step;
  const height = (loop / cfg.radius / (Math.PI * 2)) * cfg.pitch;
  const top = height / 2;

  const shared = {
    uTravel: { value: 0 },
    uHoverY: { value: 0 },
    uHoverAmp: { value: 0 },
  };
  const geo = new THREE.PlaneGeometry(1, 1, 12, 1);
  const loader = new THREE.TextureLoader();
  const meshes = [];
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  covers.forEach((src, i) => {
    const tex = loader.load(src);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, maxAniso);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    for (let r = 0; r < repeats; r++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
          map: { value: tex },
          uS0: { value: (r * covers.length + i) * step },
          uWidth: { value: cfg.cardW },
          uTravel: shared.uTravel,
          uLoop: { value: loop },
          uRadius: { value: cfg.radius },
          uPitch: { value: cfg.pitch },
          uRibbon: { value: cfg.ribbon },
          uTop: { value: top },
          uFade: { value: cfg.fade },
          uHeight: { value: height },
          uHoverY: shared.uHoverY,
          uHoverAmp: shared.uHoverAmp,
          uHoverSigma: { value: cfg.hover.sigma },
          uSide: { value: cfg.sideShade },
          uBack: { value: cfg.backShade },
        },
      });
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      group.add(m);
      meshes.push(m);
    }
  });

  let morph = 0, morphTarget = 0;
  let hoverAmpTarget = 0;
  let running = false;
  let scale = 1;
  let poseA = cfg.poseA, poseB = cfg.poseB;
  const timer = new THREE.Timer();

  function applyPose() {
    const t = morph;
    group.rotation.set(lerp(poseA.rot[0], poseB.rot[0], t), lerp(poseA.rot[1], poseB.rot[1], t), lerp(poseA.rot[2], poseB.rot[2], t));
    group.position.set(lerp(poseA.pos[0], poseB.pos[0], t) * scale, lerp(poseA.pos[1], poseB.pos[1], t) * scale, 0);
    const s = lerp(poseA.scale, poseB.scale, t) * scale;
    group.scale.setScalar(s);
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 1 единица сцены = 1px экрана на плоскости z = 0
    camera.fov = (2 * Math.atan(h / 2 / cfg.perspective) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    const mobile = w < 760;
    scale = mobile ? cfg.mobileScale : Math.min(1, w / 1440) * 0.5 + 0.5;
    poseA = mobile ? cfg.poseAMobile : cfg.poseA;
    poseB = mobile ? cfg.poseBMobile : cfg.poseB;
    applyPose();
  }

  const skip = power.throttle();
  function frame() {
    if (!running) return;
    if (skip()) { requestAnimationFrame(frame); return; }
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    shared.uTravel.value += cfg.speed * dt;
    morph += (morphTarget - morph) * cfg.morphLerp;
    shared.uHoverAmp.value += (hoverAmpTarget - shared.uHoverAmp.value) * 0.08;
    applyPose();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Наведение: переводим курсор в локальную ось спирали (приблизительно, по высоте)
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    const y = -(e.clientY - r.top - r.height / 2) / Math.max(group.scale.y, 0.001) - group.position.y / Math.max(group.scale.y, 0.001);
    shared.uHoverY.value = y;
    hoverAmpTarget = cfg.hover.gap;
  };
  const onLeave = () => { hoverAmpTarget = 0; };
  if (window.matchMedia('(hover: hover)').matches && !reducedMotion()) {
    canvas.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('pointerleave', onLeave);
  }

  const api = {
    start() { if (running) return; running = true; timer.reset(); requestAnimationFrame(frame); },
    stop() { running = false; },
    setMorph(p) { morphTarget = THREE.MathUtils.clamp(p, 0, 1); },
    dispose() { running = false; ro.disconnect(); renderer.dispose(); },
  };
  power.register({ isRunning: () => running, start: api.start, stop: api.stop });
  return api;
}
