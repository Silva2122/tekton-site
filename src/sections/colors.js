import { ScrollTrigger } from 'gsap/ScrollTrigger';
import colors from '../data/colors.json';
import { createFacade } from '../colors/facade.js';

/* Параметры материала по коллекции покрытия */
export function finishParams(id) {
  switch (id) {
    case 'metallic': return { metalness: 0.85, roughness: 0.32 };
    case 'anodized': return { metalness: 0.95, roughness: 0.28 };
    case 'chameleon': return { metalness: 0.9, roughness: 0.22, iridescence: 1 };
    case 'patina': return { metalness: 0.35, roughness: 0.7 };
    case 'scratch': return { metalness: 0.7, roughness: 0.5 };
    case 'shagreen': return { metalness: 0.2, roughness: 0.85 };
    case 'stone': case 'concrete': case 'brick': case 'fibre': case 'wood': return { metalness: 0.05, roughness: 0.8 };
    default: return { metalness: 0.3, roughness: 0.45 };
  }
}
const textured = new Set(['stone', 'concrete', 'brick', 'fibre', 'wood', 'scratch', 'shagreen', 'patina']);

/* Цвета: здание из кассет на весь экран, выбранное покрытие проявляется на фасаде */
export function initColors() {
  const root = document.querySelector('[data-colors]');
  if (!root) return;
  const canvas = root.querySelector('[data-col-canvas]');
  const tabs = root.querySelector('[data-col-tabs]');
  const swatches = root.querySelector('[data-col-swatches]');
  const current = root.querySelector('[data-col-current]');

  let facade = null;

  let cid = 'metallic';
  const renderTabs = () => {
    tabs.innerHTML = colors.map((c) => `<button type="button" role="tab" data-id="${c.id}" class="${c.id === cid ? 'is-active' : ''}">${c.name}</button>`).join('');
    tabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { cid = b.dataset.id; renderTabs(); renderSwatches(); pickWrap(0); }));
  };
  const renderSwatches = () => {
    const c = colors.find((x) => x.id === cid);
    swatches.innerHTML = c.items.map((it, i) => `<button type="button" title="${it.code} · ${it.name}" data-i="${i}" style="background-color:${it.hex};${it.map ? `background-image:url('${it.map}')` : ''}"></button>`).join('');
    swatches.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => pickWrap(+b.dataset.i)));
  };
  const pick = (i) => {
    const c = colors.find((x) => x.id === cid);
    const it = c.items[i];
    swatches.querySelectorAll('button').forEach((b, k) => b.classList.toggle('is-active', k === i));
    current.innerHTML = `<b>${it.name}</b><span>${it.code}</span>`;
    facade?.setFinish({ hex: it.hex, map: textured.has(cid) ? it.map : null, ...finishParams(cid) });
  };
  let curPick = 0;
  const pick0 = pick;
  const pickWrap = (i) => { curPick = i; pick0(i); };
  renderTabs(); renderSwatches(); pickWrap(0);

  ScrollTrigger.create({
    trigger: root.querySelector('.col__pin'),
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => facade?.setScroll(self.progress - 0.5),
  });
  // Сцену создаём, только когда секция подходит к экрану
  const create = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    create.disconnect();
    facade = createFacade(canvas);
    if (!facade) { root.classList.add('no-webgl'); return; }
    pickWrap(curPick);
    new IntersectionObserver(([v]) => (v.isIntersecting ? facade.start() : facade.stop()), { threshold: 0 }).observe(root);
  }, { rootMargin: '80% 0px' });
  create.observe(root);
}
