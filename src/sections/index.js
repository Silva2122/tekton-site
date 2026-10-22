import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import objects from '../data/objects.json';
import { motion, reducedMotion } from '../motion/config.js';
import { createSpiral } from '../objects/spiral.js';
import { createMetalStage } from '../metals/stage.js';

const reduced = reducedMotion();

/* Заголовки секций: строки выезжают из-под маски при появлении */
export function initTitles() {
  document.querySelectorAll('[data-split]').forEach((el) => {
    const words = el.innerHTML.trim().split(/\s+/);
    // Разбиваем на строки по фактической ширине: сначала по словам, потом группируем
    el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
    const spans = [...el.querySelectorAll('.w')];
    const lines = [];
    let top = null;
    spans.forEach((s) => {
      const t = s.offsetTop;
      if (t !== top) { lines.push([]); top = t; }
      lines[lines.length - 1].push(s.innerHTML);
    });
    el.innerHTML = lines.map((l) => `<span class="line"><span>${l.join(' ')}</span></span>`).join('');
    if (reduced) { el.classList.add('is-in'); return; }
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => el.classList.add('is-in') });
  });
}

/* Металлы: наведение на строку меняет картинку справа */
export function initMetals() {
  const root = document.querySelector('[data-metals]');
  if (!root) return;
  const rows = [...root.querySelectorAll('.metals__row')];
  const canvas = root.querySelector('[data-metals-canvas]');
  let stage = null, cur = 0;
  const set = (i) => {
    cur = i;
    rows.forEach((r, k) => r.classList.toggle('is-active', k === i));
    stage?.setMetal(i);
  };
  const hover = window.matchMedia('(hover: hover)').matches;
  rows.forEach((r, i) => {
    r.addEventListener(hover ? 'pointerenter' : 'click', () => set(i));
  });
  // 3D-образец создаём, когда секция подходит к экрану
  const create = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    create.disconnect();
    stage = createMetalStage(canvas);
    if (!stage) { root.classList.add('no-webgl'); return; }
    stage.setMetal(cur);
    new IntersectionObserver(([v]) => (v.isIntersecting ? stage.start() : stage.stop()), { threshold: 0 }).observe(root);
  }, { rootMargin: '80% 0px' });
  create.observe(root);
}

/* Объекты: спираль фасадов; скролл разворачивает её из наклонной позы в стену */
export function initObjects() {
  const root = document.querySelector('[data-objects]');
  const canvas = root?.querySelector('[data-spiral]');
  if (!canvas) return;
  const pin = root.querySelector('.objects__pin');
  const stageA = root.querySelector('[data-stage-a]');
  const stageB = root.querySelector('[data-stage-b]');
  const list = root.querySelector('[data-objects-list]');

  // Пиксельный значок объекта: мини-фасад 4×3, свой рисунок у каждого здания
  const GLYPHS = {
    '01': 'x.x..x.xx.x.', '02': 'xxxx....xxxx', '03': 'xx..xx..xxxx', '04': 'x.x.x.x.x.x.',
    '05': 'xxxxx..xxxxx', '06': '.xx.x..x.xx.', '07': '...x..xx.xxx', '08': 'x....x....x.',
    '09': '.x..xxx..x..', '10': 'xxxx.xx.xxxx', '11': 'x..x.xx.x..x', '12': 'xxxx........',
    '13': 'x.x.x.x.xxxx', '14': '.x.xx.x..x.x', '15': 'xxxxx.x.xxxx', '16': '.xx.xxxx.xx.', '17': 'xx.xxx.xxx.x',
  };
  const glyph = (id) => `<i class="px-glyph" aria-hidden="true">${[...(GLYPHS[id] || 'x.x..x.xx.x.')].map((c) => `<s class="${c === 'x' ? 'is-on' : ''}"></s>`).join('')}</i>`;
  list.innerHTML = objects.map((o) => `<li>${glyph(o.id)}<b>${o.name}</b><span>${o.city}</span></li>`).join('');

  // Наведение: кубики перемигиваются, один вспыхивает индиго, потом рисунок возвращается
  if (window.matchMedia('(hover: hover)').matches && !reduced) {
    list.querySelectorAll('li').forEach((li) => {
      const cells = [...li.querySelectorAll('s')];
      const base = cells.map((c) => c.classList.contains('is-on'));
      let timer = null;
      li.addEventListener('pointerenter', () => {
        let n = 0;
        clearInterval(timer);
        timer = setInterval(() => {
          const k = Math.floor(Math.random() * cells.length);
          cells[k].classList.toggle('is-on');
          cells.forEach((c) => c.classList.remove('is-accent'));
          cells[k].classList.add('is-accent');
          if (++n > 7) { clearInterval(timer); cells.forEach((c, i) => { c.classList.toggle('is-on', base[i]); c.classList.remove('is-accent'); }); }
        }, 90);
      });
    });
  }
  stageA.classList.add('is-on');

  let spiral = null;
  let morph = 0;

  ScrollTrigger.create({
    trigger: pin,
    start: 'top top',
    end: () => `+=${motion.spiral.pinDistance}`,
    pin,
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      morph = reduced ? (p > 0.5 ? 1 : 0) : p;
      spiral?.setMorph(morph);
      stageA.classList.toggle('is-on', p < 0.42);
      stageB.classList.toggle('is-on', p >= 0.42);
    },
  });
  // Сцену создаём, только когда секция подходит к экрану
  const create = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    create.disconnect();
    spiral = createSpiral(canvas, objects.map((o) => o.variants[0].src));
    if (!spiral) { root.classList.add('no-webgl'); return; }
    spiral.setMorph(morph);
    new IntersectionObserver(([v]) => (v.isIntersecting ? spiral.start() : spiral.stop()), { threshold: 0 }).observe(root);
  }, { rootMargin: '80% 0px' });
  create.observe(root);
}

/* Производство: активный этап по положению скролла, картинка справа закреплена */
export function initProduction() {
  const root = document.querySelector('[data-prod]');
  if (!root) return;
  const media = root.querySelector('[data-prod-media]');
  const steps = [...root.querySelectorAll('[data-prod-steps] li')];
  const files = ['01-receiving', '02-cutting', '03-punching', '04-bending', '05-assembly', '06-pretreatment', '07-powder', '08-inspection', '09-packing', '10-shipping'];
  // Рамка с обрезкой: картинки масштабируются внутри неё, затемнение лежит на рамке и не дрожит
  media.innerHTML = `<div class="prod__frame">${files.map((f, i) => `<img src="img/production/${f}-960.webp" alt="" loading="lazy" class="${i === 0 ? 'is-active' : ''}">`).join('')}`
    + `<span class="prod__counter" data-counter>01 / ${String(files.length).padStart(2, '0')}</span></div>`;
  const imgs = [...media.querySelectorAll('img')];
  const counter = media.querySelector('[data-counter]');

  const set = (i) => {
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    imgs.forEach((im, k) => im.classList.toggle('is-active', k === i));
    counter.textContent = `${String(i + 1).padStart(2, '0')} / ${String(files.length).padStart(2, '0')}`;
  };
  set(0);
  steps.forEach((li, i) => {
    ScrollTrigger.create({
      trigger: li,
      start: 'top 55%',
      end: 'bottom 55%',
      onEnter: () => set(i),
      onEnterBack: () => set(i),
    });
  });
}

/* Подсветка текущего раздела в нижней навигации */
export function initDock() {
  const pills = [...document.querySelectorAll('.dock__pill')];
  pills.forEach((pill) => {
    const target = document.querySelector(pill.getAttribute('href'));
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => pill.classList.toggle('is-current', self.isActive),
    });
  });
}
