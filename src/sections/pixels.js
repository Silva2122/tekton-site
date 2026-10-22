import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { reducedMotion } from '../motion/config.js';

/* Полосы из квадратиков: редкие «окна» загораются и гаснут, одно-два — индиго */
export function initPixelStrips() {
  const strips = [...document.querySelectorAll('[data-pixels]')];
  if (!strips.length) return;
  const reduced = reducedMotion();

  strips.forEach((strip) => {
    const cols = window.innerWidth < 760 ? 24 : 48;
    strip.style.setProperty('--cols', cols);
    strip.innerHTML = Array.from({ length: cols }, () => '<i></i>').join('');
    const cells = [...strip.children];
    cells.forEach((c) => c.style.setProperty('--o', (0.04 + Math.random() * 0.1).toFixed(3)));
    // Стартовый рисунок: несколько зажжённых и один акцент
    for (let k = 0; k < 5; k++) cells[Math.floor(Math.random() * cols)].classList.add('is-on');
    cells[Math.floor(Math.random() * cols)].classList.add('is-accent');
    if (reduced) return;

    let timer = null;
    const tick = () => {
      const on = cells.filter((c) => c.classList.contains('is-on'));
      if (on.length > 4 || Math.random() < 0.45) on[Math.floor(Math.random() * on.length)]?.classList.remove('is-on');
      else cells[Math.floor(Math.random() * cols)].classList.add('is-on');
      if (Math.random() < 0.06) {
        cells.forEach((c) => c.classList.remove('is-accent'));
        cells[Math.floor(Math.random() * cols)].classList.add('is-accent');
      }
      timer = setTimeout(tick, 350 + Math.random() * 600);
    };
    ScrollTrigger.create({
      trigger: strip,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => { clearTimeout(timer); if (self.isActive) tick(); },
    });
  });
}

/* Картинка собирается из блоков: плашки поверх изображения уходят в случайном порядке */
export function initPixelReveals() {
  const targets = [...document.querySelectorAll('[data-px]')];
  if (!targets.length || reducedMotion()) return;

  targets.forEach((el) => {
    const cols = +(el.dataset.px || 12);
    const rect = el.getBoundingClientRect();
    const rows = Math.max(4, Math.round(cols * (rect.height / Math.max(rect.width, 1))));
    el.classList.add('px-reveal');
    const grid = document.createElement('span');
    grid.className = 'px-reveal__grid';
    grid.style.setProperty('--px-cols', cols);
    grid.innerHTML = Array.from({ length: cols * rows }, () => '<i></i>').join('');
    el.appendChild(grid);
    const blocks = [...grid.children];

    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(blocks, {
          opacity: 0,
          duration: 0.55,
          ease: 'power2.out',
          stagger: { each: 1.1 / blocks.length, from: 'random' },
          onComplete: () => el.classList.add('is-done'),
        });
      },
    });
  });
}
