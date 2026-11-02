import { describe, expect, test } from 'bun:test';
import {
  FLY,
  GONE,
  HORIZON_PERCHES,
  LANDING,
  PERCHED,
  ROOST,
  SKY,
  SKY_LEAVE,
  SKY_WHEEL,
  createFlock,
  createSky,
  finishSky,
  flyingBirdPath,
  land,
  liftOff,
  mulberry32,
  paths,
  setPerches,
  settled,
  skyFade,
  snapToPerches,
  step,
  stepSky,
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

  test('glide paths are deterministic and finite at every wingbeat frame', () => {
    const a = run(7, 300);
    const b = run(7, 300);
    for (const t of [0, 0.07, 0.13, 0.5, 0.9, 1.7, 1234.5]) {
      const p = paths(a, 1, t);
      expect(p).toEqual(paths(b, 1, t));
      expect(p.near + p.far).not.toContain('NaN');
      expect(p.near).toContain('Z'); // filled silhouettes
      expect(p.far).toContain('Q'); // specks
    }
    // The wingbeat changes the drawing over time.
    expect(paths(a, 1, 0).near).not.toBe(paths(a, 1, 0.13).near);
    // Sharp turns (bank) and stalled birds stay finite too.
    for (let i = 0; i < a.n; i += 3) a.vx[i] = a.vy[i] = 0;
    a.bank.fill(1e6);
    expect(paths(a, 1, 0.3).near + paths(a, 1, 0.3).far).not.toContain('NaN');
  });

  test("the share button's bird fits its 10px box", () => {
    const nums = flyingBirdPath(5, 5, Math.atan2(-28, 36), 1.15).match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(nums.length).toBeGreaterThan(20);
    for (const v of nums) expect(v >= 0 && v <= 10).toBe(true);
  });
});

describe('sky timeline', () => {
  // As SkyMurmuration sets it up: a cluster at 60% width, nine perches across the right 30%.
  const sky = (n: number, w: number, h: number, seed: number) => {
    const f = createFlock(n, seed, w * 0.6, h * 0.5, 30);
    const x0 = w - Math.max(w * 0.3, HORIZON_PERCHES * 22) + 12;
    setPerches(
      f,
      Array.from({ length: n }, (_, i) => x0 + ((w - 24 - x0) * Math.min(i, HORIZON_PERCHES - 1)) / (HORIZON_PERCHES - 1)),
      Array.from({ length: n }, () => h - 0.5),
    );
    return createSky(f, w, h);
  };

  for (const [n, w, h] of [
    [150, 792, 180],
    [80, 375, 96],
  ] as const) {
    test(`${n} birds in ${w}×${h}: split, rejoin, then a clean exit`, () => {
      for (const seed of [20261101, 1, 2]) {
        const s = sky(n, w, h, seed);
        const { f } = s;
        let maxSep = 0;
        let endSep = 0;
        while (stepSky(s, 1 / 60)) {
          if (s.t >= SKY_WHEEL || !s.half) continue;
          const c = [0, 0, 0, 0, 0, 0];
          for (let i = 0; i < n; i++) {
            const k = s.half[i]! * 3;
            c[k]! += f.x[i]!;
            c[k + 1]! += f.y[i]!;
            c[k + 2]!++;
          }
          endSep = Math.hypot(c[0]! / c[2]! - c[3]! / c[5]!, c[1]! / c[2]! - c[4]! / c[5]!) / w;
          maxSep = Math.max(maxSep, endSep);
        }
        // Two flocks well apart mid-wheel, back together before streaming out.
        expect(maxSep).toBeGreaterThan(0.14);
        expect(endSep).toBeLessThan(maxSep * 0.6);
        // The exit ends by the cutoff, with almost every bird already gone and any left faded out.
        expect(s.t).toBeLessThanOrEqual(SKY_WHEEL + SKY_LEAVE + 1 / 60);
        let flying = 0;
        for (let i = 0; i < n; i++) if (f.state[i] === FLY || f.state[i] === LANDING) flying++;
        expect(flying).toBeLessThanOrEqual(Math.ceil(n * 0.03));
        if (flying > 0) expect(skyFade(s)).toBe(0);
        finishSky(s);
        for (let i = 0; i < n; i++) expect(f.state[i]).toBe(i < HORIZON_PERCHES ? PERCHED : GONE);
        expect(settled(f)).toBe(true);
        for (const arr of [f.x, f.y]) expect(arr.every(Number.isFinite)).toBe(true);
      }
    });
  }
});
