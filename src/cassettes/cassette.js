/*
 * Пять систем крепления кассет, построенных параметрически по размерам
 * из инженерного пакета RUFAS (мм). Лицевая плоскость z = 0, корпус уходит в -z.
 */
import * as THREE from 'three';

export const TYPES = [
  { id: 'open', name: 'Открытое крепление', w: 553, h: 553, d: 18,
    note: 'Крепёж остаётся в композиции фасада: простой и ремонтопригодный узел.' },
  { id: 'closed', name: 'Закрытое крепление', w: 547, h: 512, d: 25,
    note: 'Лицевая плоскость чище, фиксацию формирует верхний отгиб кассеты.' },
  { id: 'hidden', name: 'Скрытое крепление', w: 1250, h: 1210, d: 17,
    note: 'Фасад читается сплошной плоскостью, рисунок задают только швы.' },
  { id: 'sl200', name: 'Внутренняя икля SL200', w: 600, h: 800, d: 30,
    note: 'Икли приклёпаны изнутри борта, точки фиксации убраны с лицевой стороны.' },
  { id: 'sl201', name: 'Наружная икля SL201', w: 800, h: 600, d: 30,
    note: 'Икли вынесены наружу борта под геометрию конкретной подсистемы.' },
];

const T = 1.6; // визуальная толщина листа, мм

function box(mat, w, h, d, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function cylinder(mat, r, len, x, y, z, parent, axis = 'z') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20), mat);
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/* Корпус: лицевая панель и четыре борта глубиной d.
 * Детали не пересекаются: борта стоят позади лицевой панели, верх и низ — между боковыми.
 * Иначе совпадающие грани мерцают (z-fighting). */
function body(mat, w, h, d, g) {
  const dd = d - T;
  box(mat, w, h, T, 0, 0, -T / 2, g);
  box(mat, T, h, dd, -w / 2 + T / 2, 0, -T - dd / 2, g);
  box(mat, T, h, dd, w / 2 - T / 2, 0, -T - dd / 2, g);
  box(mat, w - 2 * T, T, dd, 0, h / 2 - T / 2, -T - dd / 2, g);
  box(mat, w - 2 * T, T, dd, 0, -h / 2 + T / 2, -T - dd / 2, g);
}

/* Икля: L-образный крюк, приклёпанный к борту */
function cleat(mat, steel, x, y, z, side, g, outside) {
  const dir = outside ? side : -side;
  x += outside ? 0 : -side * T; // внутренняя икля прилегает к стенке изнутри, не внутри неё
  const plate = box(steel, 1.6, 36, 13, x + dir * 0.9, y, z, g);
  box(steel, 18, 1.6, 13, x + dir * 9, y + 18, z, g); // площадка крюка
  box(steel, 1.6, 10, 13, x + dir * 18, y + 23, z, g); // вылет
  cylinder(steel, 2.6, 1.2, x + dir * 1.6, y - 8, z + 1, g, 'x');
  cylinder(steel, 2.6, 1.2, x + dir * 1.6, y + 8, z + 1, g, 'x');
  return plate;
}

export function buildCassette(type, mat, steel) {
  const g = new THREE.Group();
  const { w, h, d } = type;
  switch (type.id) {
    case 'open': {
      body(mat, w, h, d, g);
      // Задняя рамка, выступающая на 18 мм за лицевую часть
      const r = 18;
      const zb = -d - T / 2;
      box(mat, w + 2 * r, r, T, 0, h / 2 + r / 2, zb, g);
      box(mat, w + 2 * r, r, T, 0, -h / 2 - r / 2, zb, g);
      box(mat, r, h, T, -w / 2 - r / 2, 0, zb, g);
      box(mat, r, h, T, w / 2 + r / 2, 0, zb, g);
      // Четыре отверстия Ø5 на вертикальных сторонах рамки
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        cylinder(steel, 2.5, 3, sx * (w / 2 + 9), sy * (h / 2 - 60), -d - T / 2, g);
      }
      break;
    }
    case 'closed': {
      body(mat, w, h, d, g);
      const zb = -d - T / 2;
      box(mat, w, 35, T, 0, h / 2 + 17.5, zb, g); // верхний отгиб
      for (const sx of [-1, 1]) box(steel, 10, 5, 2.4, sx * (w / 2 - 11 - 5), h / 2 + 35 - 11, zb, g);
      box(mat, 15, h, T, -w / 2 + 7.5, 0, zb, g); // боковые задние полки
      box(mat, 15, h, T, w / 2 - 7.5, 0, zb, g);
      const visor = box(mat, w, 14, T, 0, -h / 2 - 6, -d - 4, g); // козырёк 45°
      visor.rotation.x = Math.PI / 4;
      break;
    }
    case 'hidden': {
      body(mat, w, h, d, g);
      // Три верхние полки-крюка 30×17 и нижняя задняя полка с центральным вырезом
      const zb = -d - T / 2;
      for (const x of [-w / 2 + 80, 0, w / 2 - 80]) {
        box(mat, 60, 17, T, x, h / 2 + 8.5, zb, g);
        box(mat, 60, T, 30, x, h / 2 + 17 + T / 2, zb - 15 - T / 2, g);
      }
      const cut = 137.5;
      box(mat, (w - cut) / 2, 30, T, -(w / 2 - (w - cut) / 4), -h / 2 - 15, zb, g);
      box(mat, (w - cut) / 2, 30, T, (w / 2 - (w - cut) / 4), -h / 2 - 15, zb, g);
      break;
    }
    case 'sl200':
    case 'sl201': {
      const outside = type.id === 'sl201';
      body(mat, w, h, d, g);
      box(mat, w, 30, T, 0, h / 2 + 15, -d - T / 2, g); // верхний отгиб 30
      const e = Math.min(100, h / 4);
      const n = Math.max(2, Math.ceil((h - 2 * e) / 500) + 1);
      for (let i = 0; i < n; i++) {
        const y = -h / 2 + e + ((h - 2 * e) / (n - 1)) * i;
        cleat(mat, steel, -w / 2, y, -d / 2, -1, g, outside);
        cleat(mat, steel, w / 2, y, -d / 2, 1, g, outside);
      }
      if (outside) {
        box(mat, w, T, 31, 0, h / 2 + 30 + T / 2, -d - T - 15.5, g); // верхняя полка глубиной 61
      }
      break;
    }
  }
  return g;
}
