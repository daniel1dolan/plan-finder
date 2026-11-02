import { describe, expect, test } from 'bun:test';
import {
  ROOST,
  SKY,
  createFlock,
  land,
  liftOff,
  mulberry32,
  paths,
  setPerches,
  settled,
  snapToPerches,
  step,
} from './flock';

const bounds = { x: 0, y: 0, w: 600, h: 300 };
const run = (seed: number, steps: number) => {
  const f = createFlock(40, seed, 300, 150, 30);
  for (let s = 0; s < steps; s++) step(f, 1 / 60, SKY, { x: 300 + 100 * Math.sin(s / 60), y: 150 }, bounds);
  return f;
};
const perchLine = (n: number) => ({
  xs: Array.from({ length: n }, (_, i) => (600 * (i + 0.5)) / n),
  ys: Array.from({ length: n }, (_, i) => 200 - i),
});

describe('flock', () => {
  test('same seed gives identical paths', () => {
    expect(paths(run(7, 300))).toEqual(paths(run(7, 300)));
    expect(paths(run(7, 300)).near).not.toBe(paths(run(8, 300)).near);
  });

  test('settles within 200 steps of landing starting', () => {
    const f = run(3, 120);
    const { xs, ys } = perchLine(f.n);
    setPerches(f, xs, ys);
    for (let i = 0; i < f.n; i++) land(f, i);
    expect(settled(f)).toBe(false);
    let s = 0;
    while (!settled(f) && s < 200) {
      step(f, 1 / 60, ROOST, { x: 300, y: 100 }, bounds);
      s++;
    }
    expect(settled(f)).toBe(true);
    for (let i = 0; i < f.n; i++) {
      expect(Math.abs(f.x[i]! - xs[i]!)).toBeLessThanOrEqual(1.5); // seeded perch jitter
      expect(f.y[i]).toBeCloseTo(ys[i]!, 3);
    }
    expect(paths(f).near).toBe('');
    expect(paths(f).perched).not.toBe('');
  });

  test('perched birds hop to moved perches, and lift off', () => {
    const f = run(5, 10);
    const { xs, ys } = perchLine(f.n);
    setPerches(f, xs, ys);
    snapToPerches(f);
    expect(settled(f)).toBe(true);
    setPerches(f, xs, ys.map((y) => y + 20));
    expect(settled(f)).toBe(false);
    for (let s = 0; s < 60; s++) step(f, 1 / 60, ROOST, { x: 0, y: 0 }, bounds);
    expect(settled(f)).toBe(true);
    liftOff(f);
    expect(f.state.every((s) => s === 0)).toBe(true);
    expect(f.vy.every((v) => v <= -40 && v >= -80)).toBe(true);
  });

  test('no NaN after 10,000 steps with random perches', () => {
    const f = createFlock(60, 11, 300, 150, 30);
    const rand = mulberry32(99);
    for (let s = 0; s < 10000; s++) {
      if (s % 700 === 0) {
        setPerches(f, Array.from({ length: f.n }, () => rand() * 600), Array.from({ length: f.n }, () => rand() * 300));
        if (s % 1400 === 0) liftOff(f);
        else for (let i = 0; i < f.n; i++) land(f, i);
      }
      step(f, rand() / 20, s % 2 ? SKY : ROOST, { x: rand() * 600, y: rand() * 300 }, bounds);
    }
    for (const arr of [f.x, f.y, f.vx, f.vy]) expect(arr.every(Number.isFinite)).toBe(true);
    expect(paths(f).near + paths(f).far + paths(f).perched).not.toContain('NaN');
  });
});

