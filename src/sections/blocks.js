import gsap from 'gsap';
import scenes from '../data/scenes.json';
import { motion, reducedMotion } from '../motion/config.js';

/* Свобода формы: строка подсвечивает свой рендер слева */
export function initShapes() {
  const root = document.querySelector('[data-shapes]');
  if (!root) return;
  const rows = [...root.querySelectorAll('[data-shapes-list] li')];
  const imgs = [...root.querySelectorAll('.shapes__media img')];
  const hover = window.matchMedia('(hover: hover)').matches;
  rows.forEach((r, i) => r.addEventListener(hover ? 'pointerenter' : 'click', () => {
    rows.forEach((x, k) => x.classList.toggle('is-active', k === i));
    imgs.forEach((im, k) => im.classList.toggle('is-active', k === i));
  }));
}

/* Лента типовых сцен и XtraMetal: едет сама по кругу, при наведении замедляется */
export function initScenes() {
  const strip = document.querySelector('[data-scenes]');
  if (!strip) return;
  const items = [...scenes.scenes.map((s) => ({ ...s, x: false })), ...scenes.xtra.map((s) => ({ ...s, x: true }))];
  const html = items.map((s) => `<figure class="scene${s.x ? ' is-x' : ''}"><img src="${s.src}" alt="${s.name}" loading="lazy"><span>${s.name}</span></figure>`).join('');
  const track = document.createElement('div');
  track.className = 'scenes__track';
  track.innerHTML = html + html; // две копии, чтобы лента была бесконечной
  strip.appendChild(track);
  if (reducedMotion()) { strip.classList.add('is-static'); return; }

  let x = 0, speed = 1, half = 0;
  const measure = () => { half = track.scrollWidth / 2; };
  measure();
  window.addEventListener('resize', measure);
  strip.addEventListener('pointerenter', () => { speed = 0.15; });
  strip.addEventListener('pointerleave', () => { speed = 1; });
  let cur = 1;
  gsap.ticker.add((t, dt) => {
    if (!half) return;
    cur += (speed - cur) * 0.06;
    x -= (motion.scenes.speed * cur * dt) / 1000;
    if (x <= -half) x += half;
    track.style.transform = `translate3d(${x}px, 0, 0)`;
  });
}

/* Форма: отправка на endpoint, если он задан; иначе письмо через почтовый клиент */
export function initRequestForm() {
  const form = document.querySelector('[data-request-form]');
  if (!form) return;
  const note = form.querySelector('[data-request-note]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.contact?.trim()) { note.textContent = 'Оставьте телефон или почту, чтобы мы могли ответить.'; form.contact.focus(); return; }
    const endpoint = form.dataset.endpoint;
    if (endpoint) {
      try {
        const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!r.ok) throw new Error(String(r.status));
        form.classList.add('is-sent');
        note.textContent = 'Запрос отправлен. Ответим в рабочий день.';
      } catch {
        note.textContent = 'Не удалось отправить. Напишите нам на почту или позвоните.';
      }
      return;
    }
    const body = `Имя: ${data.name || '—'}\nКонтакт: ${data.contact}\nОб объекте: ${data.about || '—'}`;
    location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent('Запрос расчёта фасада')}&body=${encodeURIComponent(body)}`;
    note.textContent = 'Откроется почтовый клиент с заполненным письмом.';
  });
}
