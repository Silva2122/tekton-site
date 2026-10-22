/* Все цифры моушна в одном месте: компоненты их только читают. */
export const motion = {
  scroll: { lerp: 0.1 },

  hero: {
    // Сборка стены кассет при загрузке
    assemble: { duration: 2.0, stagger: 0.03, ease: 'power4.out', spreadZ: 6, spreadXY: 0.3, tilt: 0.16 },
    // Реакция камеры на курсор
    parallax: { x: 0.35, y: 0.22, lerp: 0.045 },
    // Медленный дрейф камеры: кадр живёт даже без курсора
    drift: { amp: 0.18, period: 11 },
    // Движение ключевого света: одно медленное «проезжание» блика
    light: { period: 14 },
    // Уход стены при скролле
    scroll: { depth: 2.4, drop: 1.6 },
  },

  colors: { fade: 0.9, parallax: 0.25 },
  scenes: { speed: 38 }, // px/с, лента фрагментов

  // Спираль объектов (единицы — пиксели экрана)
  spiral: {
    radius: 410, pitch: 340, ribbon: 300, cardW: 225, gap: 28,
    repeats: 3,          // обложки повторяются, чтобы витков было несколько
    speed: 55,           // px/с вдоль ленты
    fade: 260,           // плавное исчезновение на концах спирали
    sideShade: 0.6, backShade: 0.86,
    perspective: 6000,
    morphLerp: 0.07,
    hover: { gap: 0.5, sigma: 170 },
    // Поза A — наклонная спираль за заголовком; поза B — фронтальная «стена» справа
    poseA: { rot: [-0.3316, 0.1222, 0.384], pos: [180, 80], scale: 1.0 },
    poseB: { rot: [0.3665, 1.7104, -0.2618], pos: [470, 120], scale: 0.96 },
    mobileScale: 0.62,
    poseAMobile: { rot: [-0.3316, 0.1222, 0.384], pos: [120, -60], scale: 1.0 },
    poseBMobile: { rot: [0.3665, 1.7104, -0.2618], pos: [140, 230], scale: 1.0 },
    pinDistance: 1800,
  },
};

export const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
