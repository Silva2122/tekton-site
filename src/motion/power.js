/*
 * Экономия ресурсов для WebGL-сцен.
 * — Разрешение ограничено 1.5x: на Retina это вдвое меньше пикселей без видимой потери.
 * — Пока пользователь ничего не делает, сцены рисуют 30 кадров в секунду вместо 60.
 * — Скрытая вкладка останавливает все сцены.
 */
let activeUntil = performance.now() + 4000; // первые секунды после загрузки считаем активными
const bump = () => { activeUntil = performance.now() + 1500; };
for (const e of ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'touchmove', 'keydown', 'scroll']) {
  window.addEventListener(e, bump, { passive: true });
}

const scenes = new Set();
document.addEventListener('visibilitychange', () => {
  for (const s of scenes) document.hidden ? s.sleep() : s.wake();
});

export const power = {
  dpr: () => Math.min(window.devicePixelRatio || 1, 1.5),
  gl: { antialias: true, powerPreference: 'default' },
  active: () => performance.now() < activeUntil,
  /* Принудительно активный режим на ms: нужен сразу после прелоадера, пока идёт сборка стены */
  wake(ms) { activeUntil = Math.max(activeUntil, performance.now() + ms); },

  /* Возвращает функцию: true — этот кадр пропускаем */
  throttle() {
    let odd = false;
    return () => {
      if (power.active()) { odd = false; return false; }
      odd = !odd;
      return odd;
    };
  },

  /* Регистрация сцены: пауза при скрытой вкладке, не трогая её собственный флаг видимости */
  register(scene) {
    let wasRunning = false;
    const entry = {
      sleep() { wasRunning = scene.isRunning(); scene.stop(); },
      wake() { if (wasRunning) scene.start(); },
    };
    scenes.add(entry);
    return () => scenes.delete(entry);
  },
};
