import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { motion, reducedMotion } from './motion/config.js';
import { createWall } from './hero/wall.js';
import { createPreloader } from './preloader/index.js';
import { initTitles, initMetals, initObjects, initProduction, initDock } from './sections/index.js';
import { initPixelStrips, initPixelReveals } from './sections/pixels.js';
import { initCassettes } from './sections/cassettes.js';
import { initColors } from './sections/colors.js';
import { initShapes, initScenes, initRequestForm } from './sections/blocks.js';
import { initViewer } from './sections/viewer.js';

gsap.registerPlugin(ScrollTrigger);

// Плавный скролл через Lenis, синхронизированный с тикером GSAP
const lenis = new Lenis({ lerp: motion.scroll.lerp, smoothWheel: !reducedMotion() });
lenis.on('scroll', ScrollTrigger.update);

// Фон плывёт со скроллом: сетка медленнее страницы, свет чуть гуляет по горизонтали
const bgGrid = document.querySelector('[data-bg-grid]');
const bgGlow = document.querySelector('[data-bg-glow]');
lenis.on('scroll', ({ scroll }) => {
  bgGrid.style.transform = `translate3d(0, ${-scroll * 0.06}px, 0)`;
  bgGlow.style.transform = `translate3d(${Math.sin(scroll / 2600) * 30}vw, ${scroll * 0.04}px, 0)`;
});
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

const hero = document.querySelector('[data-hero]');
const head = document.querySelector('[data-head]');
const dock = document.querySelector('[data-dock]');
const canvas = document.querySelector('[data-wall]');

function reveal() {
  hero.classList.add('is-ready');
  head.classList.add('is-ready');
  dock.classList.add('is-ready');
}

const STATIC = new URLSearchParams(location.search).has('static');
if (STATIC) document.documentElement.classList.add('is-static');

// Первый экран считается готовым после первого кадра стены (или через 2.5 с, если WebGL завис)
let wallReady;
const ready = Promise.race([new Promise((r) => { wallReady = r; }), new Promise((r) => setTimeout(r, 2500))]);
const wall = canvas ? createWall(canvas, { onReady: () => wallReady() }) : null;

if (STATIC || reducedMotion() || !wall) {
  reveal();
} else {
  // Прелоадер: сетка кубиков собирается в знак, потом стена начинает сборку
  wall.hold();
  lenis.stop();
  window.scrollTo(0, 0);
  const pre = createPreloader({ ready });
  pre.leaving.then(() => wall.release()); // кассеты начинают собираться под растворяющимся прелоадером
  pre.done.then(() => { reveal(); lenis.start(); });
}

if (!wall) {
  hero.classList.add('no-webgl');
} else {
  // Стена уходит в глубину, пока первый экран уезжает вверх
  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => wall.setScroll(self.progress),
  });
  // Не рендерим, пока первый экран не виден
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? wall.start() : wall.stop()), { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? wall.stop() : wall.start()));
}

// Страховка: что бы ни случилось, через 7 секунд страница доступна
setTimeout(() => { reveal(); wall?.release(); lenis.start(); }, 7000);

// После первого экрана логотип уходит из шапки в нижнюю панель
ScrollTrigger.create({
  trigger: hero,
  start: 'bottom 120px',
  onEnter: () => { head.classList.add('is-scrolled'); dock.classList.add('is-scrolled'); },
  onLeaveBack: () => { head.classList.remove('is-scrolled'); dock.classList.remove('is-scrolled'); },
});

// Якорные ссылки: плавный проезд к блоку через Lenis (учитывает пины ScrollTrigger)
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id === '#') return;
  const target = id === '#top' ? 0 : document.querySelector(id);
  if (target === null) return;
  e.preventDefault();
  lenis.scrollTo(target, {
    offset: target === 0 ? 0 : -8,
    duration: 1.4,
    easing: (t) => 1 - Math.pow(1 - t, 4),
  });
  history.replaceState(null, '', id);
});

document.fonts.ready.then(() => {
  initTitles();
  initMetals();
  initObjects();
  initCassettes();
  initColors();
  initShapes();
  initScenes();
  initRequestForm();
  initViewer(lenis);
  initProduction();
  initDock();
  initPixelStrips();
  initPixelReveals();
  ScrollTrigger.refresh();
});
