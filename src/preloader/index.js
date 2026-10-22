/*
 * Прелоадер: сетка кубиков мерцает, пока грузится первый экран,
 * затем собирается в плашку со знаком «Тектон» и растворяется.
 */
const N = 30, CELL = 7, GAP = 2;
const INDIGO = [87, 104, 229];
const WHITE = [243, 243, 243];
const DIM = [28, 28, 32];
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => `rgb(${lerp(a[0], b[0], t) | 0},${lerp(a[1], b[1], t) | 0},${lerp(a[2], b[2], t) | 0})`;
const easeOut = (x) => 1 - Math.pow(1 - x, 3);

export function createPreloader({ ready, minDuration = 1500, maxDuration = 4500 }) {
  const el = document.createElement('div');
  el.className = 'preloader';
  el.innerHTML = '<canvas aria-hidden="true"></canvas>';
  document.body.prepend(el);

  const c = el.querySelector('canvas');
  const size = N * (CELL + GAP) - GAP;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = size * dpr; c.height = size * dpr;
  c.style.width = c.style.height = `${size}px`;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);

  const total = N * N;
  const bright = new Float32Array(total);        // мерцание, 0..1
  const sign = new Uint8Array(total);            // 1 — кубик входит в знак
  const delay = new Float32Array(total);         // задержка сборки, с
  const mid = (N - 1) / 2;
  for (let i = 0; i < total; i++) {
    const x = i % N, y = (i / N) | 0;
    delay[i] = (Math.hypot(x - mid, y - mid) / mid) * 0.35 + Math.random() * 0.25;
  }

  // Растеризуем знак в сетку N×N
  const img = new Image();
  img.src = 'brand/tekton-sign-white.svg';
  img.onload = () => {
    const o = document.createElement('canvas');
    o.width = o.height = N;
    const g = o.getContext('2d');
    g.drawImage(img, 0, 0, N, N);
    const d = g.getImageData(0, 0, N, N).data;
    for (let i = 0; i < total; i++) sign[i] = d[i * 4 + 3] > 100 ? 1 : 0;
  };

  let phase = 'load';                 // load → build → out
  let buildStart = 0, lastFlick = 0;
  const t0 = performance.now();
  let resolveDone, resolveLeaving;
  const done = new Promise((r) => { resolveDone = r; });
  const leaving = new Promise((r) => { resolveLeaving = r; });
  let readyFlag = false;
  ready.then(() => { readyFlag = true; });

  function draw(now) {
    const dt = Math.min((now - (draw.prev || now)) / 1000, 0.05);
    draw.prev = now;
    const elapsed = now - t0;

    if (phase === 'load') {
      if (now - lastFlick > 70) {
        lastFlick = now;
        for (let k = 0; k < 7; k++) bright[(Math.random() * total) | 0] = 0.45 + Math.random() * 0.4;
      }
      for (let i = 0; i < total; i++) bright[i] = Math.max(0, bright[i] - dt * 1.6);
      if ((readyFlag && elapsed >= minDuration) || elapsed >= maxDuration) { phase = 'build'; buildStart = now; }
    }

    const bt = phase === 'load' ? 0 : (now - buildStart) / 1000;
    ctx.clearRect(0, 0, size, size);
    let finished = phase === 'build';
    for (let i = 0; i < total; i++) {
      const x = (i % N) * (CELL + GAP), y = ((i / N) | 0) * (CELL + GAP);
      let p = 0;
      if (phase !== 'load') {
        p = easeOut(Math.min(1, Math.max(0, (bt - delay[i]) / 0.5)));
        if (p < 1) finished = false;
      }
      const flick = mix(DIM, WHITE, bright[i] * (1 - p));
      ctx.fillStyle = p > 0 ? mix([DIM[0] + bright[i] * 120, DIM[1] + bright[i] * 120, DIM[2] + bright[i] * 120], sign[i] ? WHITE : INDIGO, p) : flick;
      ctx.beginPath();
      ctx.roundRect(x, y, CELL, CELL, 1.5);
      ctx.fill();
    }

    if (phase === 'build' && finished) {
      phase = 'out';
      setTimeout(() => {
        el.classList.add('is-out');
        resolveLeaving();
        setTimeout(() => { resolveDone(); el.remove(); }, 650);
      }, 380);
    }
    if (phase !== 'out') requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  return { done, leaving };
}
