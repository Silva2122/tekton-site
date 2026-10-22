/* Просмотр чертежей: клик по листу открывает его на весь экран, колесо и щипок приближают, перетаскивание двигает */
export function initViewer(lenis) {
  const items = [...document.querySelectorAll('[data-view]')];
  if (!items.length) return;

  const root = document.createElement('div');
  root.className = 'viewer';
  root.innerHTML = `
    <div class="viewer__stage" data-stage><img alt="" draggable="false"></div>
    <div class="viewer__bar">
      <span class="viewer__title glass" data-title></span>
      <div class="viewer__tools">
        <button type="button" class="glass" data-zoom="-1" aria-label="Отдалить">−</button>
        <span class="glass" data-pct>100%</span>
        <button type="button" class="glass" data-zoom="1" aria-label="Приблизить">+</button>
        <button type="button" class="glass" data-close aria-label="Закрыть">Закрыть</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  const stage = root.querySelector('[data-stage]');
  const img = stage.querySelector('img');
  const title = root.querySelector('[data-title]');
  const pct = root.querySelector('[data-pct]');

  let scale = 1, min = 1, x = 0, y = 0, drag = null, pinch = null;
  const apply = () => {
    img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    pct.textContent = `${Math.round((scale / min) * 100)}%`;
  };
  // Границы: лист не уходит с экрана целиком
  const clamp = () => {
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const mx = Math.max(0, (w - sw) / 2), my = Math.max(0, (h - sh) / 2);
    x = Math.min(mx, Math.max(-mx, x));
    y = Math.min(my, Math.max(-my, y));
  };
  const fit = () => {
    min = Math.min(stage.clientWidth / img.naturalWidth, stage.clientHeight / img.naturalHeight) * 0.94;
    scale = min; x = 0; y = 0; apply();
  };
  const zoomAt = (factor, cx, cy) => {
    const next = Math.min(min * 6, Math.max(min, scale * factor));
    const k = next / scale;
    // точка под курсором остаётся на месте
    x = cx + (x - cx) * k;
    y = cy + (y - cy) * k;
    scale = next;
    clamp(); apply();
  };
  const center = (e) => {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2];
  };

  const open = (src, name) => {
    title.textContent = name;
    root.classList.add('is-open');
    document.documentElement.classList.add('is-viewer');
    lenis?.stop();
    img.style.opacity = '0';
    img.onload = () => { img.style.setProperty('--w', img.naturalWidth + 'px'); img.style.setProperty('--h', img.naturalHeight + 'px'); img.width = img.naturalWidth; img.height = img.naturalHeight; fit(); img.style.opacity = '1'; };
    img.src = src;
    if (img.complete && img.naturalWidth) img.onload();
  };
  const close = () => {
    root.classList.remove('is-open');
    document.documentElement.classList.remove('is-viewer');
    lenis?.start();
  };

  items.forEach((el) => {
    el.style.cursor = 'zoom-in';
    el.addEventListener('click', () => open(el.dataset.view, el.dataset.viewName || el.querySelector('figcaption, span')?.textContent || ''));
  });
  root.querySelector('[data-close]').addEventListener('click', close);
  root.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => zoomAt(b.dataset.zoom === '1' ? 1.5 : 1 / 1.5, 0, 0)));
  // Клик по фону закрывает, только если мышь не двигалась (иначе это было перетаскивание)
  let downAt = null;
  stage.addEventListener('click', (e) => { if (e.target === stage && downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 4) close(); });
  document.addEventListener('keydown', (e) => { if (root.classList.contains('is-open') && e.key === 'Escape') close(); });

  root.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [cx, cy] = center(e);
    zoomAt(Math.exp(-e.deltaY * 0.0022), cx, cy);
  }, { passive: false });
  img.addEventListener('dblclick', (e) => { const [cx, cy] = center(e); zoomAt(scale > min * 1.5 ? 0.01 : 2.5, cx, cy); });

  const pointers = new Map();
  stage.addEventListener('pointerdown', (e) => {
    downAt = [e.clientX, e.clientY];
    pointers.set(e.pointerId, e);
    stage.setPointerCapture(e.pointerId);
    if (pointers.size === 1) { drag = { x: e.clientX - x, y: e.clientY - y }; stage.classList.add('is-drag'); }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), s: scale };
      drag = null;
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const r = stage.getBoundingClientRect();
      const cx = (a.clientX + b.clientX) / 2 - r.left - r.width / 2, cy = (a.clientY + b.clientY) / 2 - r.top - r.height / 2;
      zoomAt((pinch.s * (d / pinch.d)) / scale, cx, cy);
      return;
    }
    if (drag) { x = e.clientX - drag.x; y = e.clientY - drag.y; clamp(); apply(); }
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (!pointers.size) { drag = null; stage.classList.remove('is-drag'); } };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  window.addEventListener('resize', () => { if (root.classList.contains('is-open')) fit(); });
}
