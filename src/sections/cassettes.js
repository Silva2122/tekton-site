import { createCassetteStage } from '../cassettes/stage.js';
import { TYPES } from '../cassettes/cassette.js';
import colors from '../data/colors.json';
import { finishParams } from './colors.js';

/* Кассеты: список типов слева, живая модель справа, палитра из нескольких цветов */
export function initCassettes() {
  const root = document.querySelector('[data-cassettes]');
  if (!root) return;
  const canvas = root.querySelector('[data-cas-canvas]');
  const list = root.querySelector('[data-cas-types]');
  const spec = root.querySelector('[data-cas-spec]');
  const chips = root.querySelector('[data-cas-colors]');

  list.innerHTML = TYPES.map((t, i) => `<li data-i="${i}" class="${i === 0 ? 'is-active' : ''}"><b>0${i + 1}</b><span class="name">${t.name}</span><span class="note">${t.note}</span></li>`).join('');
  const rows = [...list.children];

  let stage = null;
  let curType = 0;

  const showSpec = (t) => {
    spec.innerHTML = `<span>Ширина<b>${t.w} мм</b></span><span>Высота<b>${t.h} мм</b></span><span>Глубина<b>${t.d} мм</b></span><span>Лист<b>0,5–3 мм</b></span>`;
  };
  showSpec(TYPES[0]);
  rows.forEach((li) => li.addEventListener('click', () => {
    const i = +li.dataset.i;
    curType = i;
    rows.forEach((r) => r.classList.toggle('is-active', r === li));
    stage?.setType(i);
    showSpec(TYPES[i]);
  }));

  // Несколько характерных цветов: по одному-два из коллекций
  const picks = [
    ['solid', 0], ['solid', 3], ['metallic', 0], ['metallic', 4], ['anodized', 2],
    ['chameleon', 0], ['patina', 2], ['wood', 2], ['brick', 1], ['fibre', 2],
  ];
  chips.innerHTML = picks.map(([cid, idx], k) => {
    const c = colors.find((x) => x.id === cid); const it = c.items[idx];
    return `<button type="button" style="background:${it.hex}" title="${it.name}" data-c="${cid}" data-i="${idx}" class="${k === 4 ? 'is-active' : ''}"></button>`;
  }).join('');
  const buttons = [...chips.children];
  let curBtn = buttons[4];
  const apply = (btn) => {
    curBtn = btn;
    const c = colors.find((x) => x.id === btn.dataset.c); const it = c.items[+btn.dataset.i];
    buttons.forEach((b) => b.classList.toggle('is-active', b === btn));
    stage?.setColor(it.hex, finishParams(c.id));
  };
  buttons.forEach((b) => b.addEventListener('click', () => apply(b)));
  buttons.forEach((b) => b.classList.toggle('is-active', b === curBtn));

  // Сцену создаём, только когда секция подходит к экрану; рендерим, пока она видна
  const create = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    create.disconnect();
    stage = createCassetteStage(canvas);
    if (!stage) { root.classList.add('no-webgl'); return; }
    stage.setType(curType, false);
    apply(curBtn);
    new IntersectionObserver(([v]) => (v.isIntersecting ? stage.start() : stage.stop()), { threshold: 0 }).observe(root);
  }, { rootMargin: '80% 0px' });
  create.observe(root);
}
