// Starling flock: topological boids (k nearest neighbours) plus landing onto perches.
// Pure and allocation-free per step, so it runs under bun test and inside a rAF loop alike.

export interface FlockParams {
  minSpeed: number;
  maxSpeed: number;
  maxForce: number;
  sepRadius: number;
  wSep: number;
  wAli: number;
  wCoh: number;
  wHome: number;
  edge: number;
}
export const SKY: FlockParams = { minSpeed: 38, maxSpeed: 92, maxForce: 140, sepRadius: 9, wSep: 1.6, wAli: 1.0, wCoh: 0.55, wHome: 0.35, edge: 24 };
export const ROOST: FlockParams = { minSpeed: 45, maxSpeed: 115, maxForce: 180, sepRadius: 7, wSep: 1.6, wAli: 1.0, wCoh: 0.6, wHome: 0.6, edge: 12 };

export const FLY = 0;
export const LANDING = 1;
export const PERCHED = 2;
export const GONE = 3;

export interface Flock {
  n: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  state: Uint8Array; // FLY | LANDING | PERCHED | GONE
  far: Uint8Array;
  flip: Int8Array; // perched birds face left or right
  jitter: Float32Array; // perched x offset, so the row looks organic
  landAge: Float32Array; // seconds since land()
  bank: Float32Array; // smoothed signed turn rate (rad/s): distant birds show their wings in turns
  turnIn: number; // seconds until the next turning wave
  rand: () => number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createFlock(n: number, seed: number, cx: number, cy: number, radius: number): Flock {
  const rand = mulberry32(seed);
  const f: Flock = {
    n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    tx: new Float32Array(n),
    ty: new Float32Array(n),
    state: new Uint8Array(n),
    far: new Uint8Array(n),
    flip: new Int8Array(n),
    jitter: new Float32Array(n),
    landAge: new Float32Array(n),
    bank: new Float32Array(n),
    turnIn: 2.5 + rand() * 1.5,
    rand,
  };
  const heading = rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const r = radius * Math.sqrt(rand());
    const a = rand() * Math.PI * 2;
    f.x[i] = f.tx[i] = cx + r * Math.cos(a);
    f.y[i] = f.ty[i] = cy + r * Math.sin(a);
    const h = heading + (rand() - 0.5) * 0.8;
    f.vx[i] = 50 * Math.cos(h);
    f.vy[i] = 50 * Math.sin(h);
    f.far[i] = rand() < 0.5 ? 1 : 0;
    f.flip[i] = rand() < 0.5 ? -1 : 1;
    f.jitter[i] = (rand() - 0.5) * 3;
  }
  return f;
}

// Each bird watches its 7 nearest neighbours, as starlings do. Scratch arrays are shared because
// steps never interleave.
const K = 7;
const nIdx = new Int32Array(K);
const nDist = new Float32Array(K);

const LAND_CAP = 0.9; // seconds of free landing before the 300ms lerp takes over
const LERP = 0.3;
const HOP_TAU = 0.08; // ≈350ms ease-out glide for perched birds
const BANK_TAU = 0.18;

function clampMag(x: number, y: number, max: number): [number, number] {
  const m = Math.hypot(x, y);
  return m > max ? [(x / m) * max, (y / m) * max] : [x, y];
}

/** Steering toward a desired direction at full speed (Reynolds). */
function seek(dx: number, dy: number, vx: number, vy: number, p: FlockParams): [number, number] {
  const m = Math.hypot(dx, dy);
  if (m < 1e-6) return [0, 0];
  return clampMag((dx / m) * p.maxSpeed - vx, (dy / m) * p.maxSpeed - vy, p.maxForce);
}

type Point = { x: number; y: number };
/** One home per bird, by index. */
export type Homes = { x: Float32Array; y: Float32Array };

/**
 * dt must already be clamped (the loop does it). bounds = null turns the edge force off. `home` is
 * either one point for the whole flock or one per bird.
 */
export function step(f: Flock, dt: number, p: FlockParams, home: Point | Homes, bounds: { x: number; y: number; w: number; h: number } | null): void {
  if (dt <= 0) return;
  const homes = home.x instanceof Float32Array ? (home as Homes) : null;
  const shared = home as Point;

  f.turnIn -= dt;
  if (f.turnIn <= 0) {
    f.turnIn = 2.5 + f.rand() * 1.5;
    const i = Math.floor(f.rand() * f.n);
    if (f.state[i] === FLY) {
      // One bird turns; alignment carries the ripple through the flock.
      const a = ((f.rand() < 0.5 ? -40 : 40) * Math.PI) / 180;
      const vx = f.vx[i]!;
      const vy = f.vy[i]!;
      f.vx[i] = vx * Math.cos(a) - vy * Math.sin(a);
      f.vy[i] = vx * Math.sin(a) + vy * Math.cos(a);
    }
  }

  for (let i = 0; i < f.n; i++) {
    const s = f.state[i];
    const x = f.x[i]!;
    const y = f.y[i]!;
    const vx = f.vx[i]!;
    const vy = f.vy[i]!;

    if (s === GONE) continue;

    if (s === PERCHED) {
      const t = 1 - Math.exp(-dt / HOP_TAU);
      f.x[i] = x + (f.tx[i]! - x) * t;
      f.y[i] = y + (f.ty[i]! - y) * t;
      if (Math.hypot(f.tx[i]! - f.x[i]!, f.ty[i]! - f.y[i]!) < 0.3) {
        f.x[i] = f.tx[i]!;
        f.y[i] = f.ty[i]!;
      }
      continue;
    }

    if (s === LANDING) {
      const age = (f.landAge[i] = f.landAge[i]! + dt);
      const dx = f.tx[i]! - x;
      const dy = f.ty[i]! - y;
      const d = Math.hypot(dx, dy);
      if (age > LAND_CAP) {
        const left = LAND_CAP + LERP - (age - dt);
        const t = left <= dt ? 1 : dt / left;
        f.x[i] = x + dx * t;
        f.y[i] = y + dy * t;
        f.vx[i] = dx / Math.max(left, dt);
        f.vy[i] = dy / Math.max(left, dt);
      } else {
        // Arrival: desired speed falls off inside a 40px slowing radius.
        const want = d < 1e-6 ? 0 : (p.maxSpeed * Math.min(1, d / 40)) / d;
        const [ax, ay] = clampMag((dx * want - vx) * 8, (dy * want - vy) * 8, p.maxForce * 3);
        f.vx[i] = vx + ax * dt;
        f.vy[i] = vy + ay * dt;
        f.x[i] = x + f.vx[i]! * dt;
        f.y[i] = y + f.vy[i]! * dt;
      }
      if (age >= LAND_CAP + LERP || (Math.hypot(f.tx[i]! - f.x[i]!, f.ty[i]! - f.y[i]!) < 0.6 && Math.hypot(f.vx[i]!, f.vy[i]!) < 5)) {
        f.x[i] = f.tx[i]!;
        f.y[i] = f.ty[i]!;
        f.vx[i] = f.vy[i] = 0;
        f.state[i] = PERCHED;
      }
      continue;
    }

    // Flying: find the k nearest flying neighbours by insertion.
    let found = 0;
    for (let j = 0; j < f.n; j++) {
      if (j === i || f.state[j] !== FLY) continue;
      const d = Math.hypot(f.x[j]! - x, f.y[j]! - y);
      if (found < K) found++;
      else if (d >= nDist[K - 1]!) continue;
      let m = found - 1;
      while (m > 0 && nDist[m - 1]! > d) {
        nDist[m] = nDist[m - 1]!;
        nIdx[m] = nIdx[m - 1]!;
        m--;
      }
      nDist[m] = d;
      nIdx[m] = j;
    }

    let fx = 0;
    let fy = 0;
    if (found > 0) {
      let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0;
      for (let m = 0; m < found; m++) {
        const j = nIdx[m]!;
        const d = nDist[m]!;
        if (d > 1e-6 && d < p.sepRadius) {
          sx += (x - f.x[j]!) / (d * d);
          sy += (y - f.y[j]!) / (d * d);
        }
        ax += f.vx[j]!;
        ay += f.vy[j]!;
        cx += f.x[j]!;
        cy += f.y[j]!;
      }
      const [s1, s2] = seek(sx, sy, vx, vy, p);
      const [a1, a2] = seek(ax, ay, vx, vy, p);
      const [c1, c2] = seek(cx / found - x, cy / found - y, vx, vy, p);
      fx += s1 * p.wSep + a1 * p.wAli + c1 * p.wCoh;
      fy += s2 * p.wSep + a2 * p.wAli + c2 * p.wCoh;
    }
    const [h1, h2] = homes ? seek(homes.x[i]! - x, homes.y[i]! - y, vx, vy, p) : seek(shared.x - x, shared.y - y, vx, vy, p);
    fx += h1 * p.wHome;
    fy += h2 * p.wHome;

    if (bounds && p.edge > 0) {
      const e = p.edge;
      if (x < bounds.x + e) fx += (p.maxForce * (bounds.x + e - x)) / e;
      if (x > bounds.x + bounds.w - e) fx -= (p.maxForce * (x - (bounds.x + bounds.w - e))) / e;
      if (y < bounds.y + e) fy += (p.maxForce * (bounds.y + e - y)) / e;
      if (y > bounds.y + bounds.h - e) fy -= (p.maxForce * (y - (bounds.y + bounds.h - e))) / e;
    }

    const [Fx, Fy] = clampMag(fx, fy, p.maxForce);
    let nvx = vx + Fx * dt;
    let nvy = vy + Fy * dt;
    const sp = Math.hypot(nvx, nvy);
    if (sp < 1e-6) {
      nvx = p.minSpeed;
      nvy = 0;
    } else if (sp > p.maxSpeed || sp < p.minSpeed) {
      const target = Math.min(p.maxSpeed, Math.max(p.minSpeed, sp));
      nvx = (nvx / sp) * target;
      nvy = (nvy / sp) * target;
    }
    // Turn rate from the change of heading, smoothed; positive is clockwise on screen.
    const turn = (vx * nvy - vy * nvx) / (Math.max(1e-6, Math.hypot(vx, vy) * Math.hypot(nvx, nvy)) * dt);
    f.bank[i] = f.bank[i]! + (turn - f.bank[i]!) * (1 - Math.exp(-dt / BANK_TAU));
    f.vx[i] = nvx;
    f.vy[i] = nvy;
    f.x[i] = x + nvx * dt;
    f.y[i] = y + nvy * dt;
  }
}

/** Sets targets; doesn't change state, so mid-flight changes just retarget. */
export function setPerches(f: Flock, xs: ArrayLike<number>, ys: ArrayLike<number>): void {
  for (let i = 0; i < f.n; i++) {
    f.tx[i] = (xs[i] ?? f.tx[i]!) + f.jitter[i]!;
    f.ty[i] = ys[i] ?? f.ty[i]!;
  }
}

export function land(f: Flock, i: number): void {
  if (f.state[i] !== FLY) return;
  f.state[i] = LANDING;
  f.landAge[i] = 0;
}

export function liftOff(f: Flock): void {
  for (let i = 0; i < f.n; i++) {
    if (f.state[i] === GONE) continue;
    f.state[i] = FLY;
    f.vy[i] = -(40 + f.rand() * 40);
    f.vx[i] = (f.rand() - 0.5) * 60;
  }
}

/** Removes flying birds outside the bounds (the sky flock leaving). Returns how many still fly. */
export function dropOutside(f: Flock, b: { x: number; y: number; w: number; h: number }): number {
  let flying = 0;
  for (let i = 0; i < f.n; i++) {
    if (f.state[i] !== FLY) continue;
    const x = f.x[i]!;
    const y = f.y[i]!;
    if (x < b.x - 10 || x > b.x + b.w + 10 || y < b.y - 10 || y > b.y + b.h + 10) f.state[i] = GONE;
    else flying++;
  }
  return flying;
}

export function settled(f: Flock): boolean {
  for (let i = 0; i < f.n; i++) {
    const s = f.state[i];
    if (s === GONE) continue;
    if (s !== PERCHED || f.x[i] !== f.tx[i] || f.y[i] !== f.ty[i]) return false;
  }
  return true;
}

export function snapToPerches(f: Flock): void {
  for (let i = 0; i < f.n; i++) {
    if (f.state[i] === GONE) continue;
    f.x[i] = f.tx[i]!;
    f.y[i] = f.ty[i]!;
    f.vx[i] = f.vy[i] = 0;
    f.state[i] = PERCHED;
  }
}

const r1 = (v: number) => Math.round(v * 10) / 10;

// A perched starling in side view, feet at (0, 0), facing +x: tail, back, crown, beak, breast, legs.
// About 12 × 8px at scale 1.
const PERCHED_SHAPE: [string, number, number][] = [
  ['M', -6, -2.2], ['L', -3.6, -3.2], ['Q', -2.6, -6.4], ['', 1, -6.2], ['Q', 2.2, -8], ['', 3.8, -7.3],
  ['L', 6, -6.6], ['L', 4.2, -5.7], ['Q', 4.4, -2.6], ['', 1.6, -1.6], ['L', 1, 0], ['L', 0.4, 0],
  ['L', 0.5, -1.4], ['Q', -1.8, -1.2], ['', -3.6, -2.2], ['L', -6.4, -1.2],
];

// A starling in flight from below: a small four-pointed star. Heading +a, half-span +b: beak, head,
// shoulder, wingtip (shoulder + (−sweep, span)), trailing root, tail root, tail corner; mirrored.
// Frames: level, downstroke (wings forward), upstroke (raised, so foreshortened); then the glide.
const FLAP_FRAMES: [span: number, sweep: number][] = [
  [3.1, 1.6],
  [2.6, 0.6],
  [1.6, 1.0],
];
const GLIDE: [span: number, sweep: number] = [3.3, 2.0];
const FLAP_STEPS = 16; // frame changes per second: a 4-step ping-pong, so 4 wingbeats a second
const FLAP_CYCLE = 1.2; // seconds: level birds flap for the first 38% of each cycle, then glide
const pingPong = (k: number) => [0, 1, 2, 1][k & 3]!;
// Per-bird phase from the index (golden ratio), so it doesn't draw on the seeded PRNG.
const phaseOf = (i: number) => (i * 0.6180339887) % 1;

/**
 * Path data for each kind of bird. `scale` sizes them; perched birds stand on their perch point.
 * `t` (seconds) drives the wingbeat. Near birds are starling silhouettes that flap to climb and in
 * bursts, and glide otherwise; far birds are specks.
 */
export function paths(f: Flock, scale = 1, t = 0): { near: string; far: string; perched: string } {
  let near = '';
  let far = '';
  let perched = '';
  for (let i = 0; i < f.n; i++) {
    const s = f.state[i];
    if (s === GONE) continue;
    const x = f.x[i]!;
    const y = f.y[i]!;
    if (s === PERCHED) {
      const d = f.flip[i]! * scale;
      for (const [cmd, px, py] of PERCHED_SHAPE) perched += `${cmd}${r1(x + px * d)} ${r1(y + py * scale)} `;
      perched += 'Z';
      continue;
    }
    const sp = Math.hypot(f.vx[i]!, f.vy[i]!) || 1;
    const hx = f.vx[i]! / sp;
    const hy = f.vy[i]! / sp;
    const ph = phaseOf(i);
    if (f.far[i]) {
      far += speck(x, y, hx, hy, 0.7 * scale, f.bank[i]!, t, ph);
      continue;
    }
    const flapping = hy < -0.3 || (t / FLAP_CYCLE + ph) % 1 < 0.38;
    near += silhouette(x, y, hx, hy, 0.85 * scale, flapping ? FLAP_FRAMES[pingPong(Math.floor(t * FLAP_STEPS + ph * 4))]! : GLIDE);
  }
  return { near, far, perched };
}

/** The gliding silhouette centred on (x, y), heading `angle` radians: the share button's bird. */
export function flyingBirdPath(x: number, y: number, angle: number, scale: number): string {
  return silhouette(x, y, Math.cos(angle), Math.sin(angle), scale, GLIDE);
}

/** Local (a forward, b across) → screen, as "x y". */
const pt = (x: number, y: number, hx: number, hy: number, k: number, a: number, b: number) =>
  `${r1(x + (a * hx - b * hy) * k)} ${r1(y + (a * hy + b * hx) * k)}`;

function silhouette(x: number, y: number, hx: number, hy: number, k: number, [span, sweep]: [number, number]): string {
  const P = (a: number, b: number) => pt(x, y, hx, hy, k, a, b);
  return (
    `M${P(2.2, 0)}L${P(1.5, 0.45)}L${P(0.9, 0.6)}L${P(0.9 - sweep, 0.6 + span)}L${P(-0.6, 0.55)}L${P(-1.0, 0.4)}` +
    `L${P(-1.9, 0.6)}L${P(-1.8, 0)}L${P(-1.9, -0.6)}L${P(-1.0, -0.4)}L${P(-0.6, -0.55)}` +
    `L${P(0.9 - sweep, -0.6 - span)}L${P(0.9, -0.6)}L${P(1.5, -0.45)}Z`
  );
}

/**
 * A distant starling is a speck whose width is its wings. Straight and level it shows little; in a
 * turn it banks and shows the whole wing plane, so a turning wave darkens across the flock.
 */
function speck(x: number, y: number, hx: number, hy: number, k: number, bank: number, t: number, ph: number): string {
  const show = Math.min(1, Math.abs(bank) / 1.4);
  const S = 1.3 + 2.4 * show + 0.12 * Math.sin((t * 4 + ph) * Math.PI * 2); // half-span, with a faint wingbeat
  const T = 1.1 + 0.25 * show; // body
  const P = (a: number, b: number) => pt(x, y, hx, hy, k, a, b);
  return `M${P(-0.3 * S, -S)}Q${P(1.7 * T, 0)} ${P(-0.3 * S, S)}Q${P(-0.5 * T, 0)} ${P(-0.3 * S, -S)}Z`;
}

// The intro's sky flock (D6): it splits in two and rejoins for SKY_WHEEL seconds, then streams out
// low and right while nine birds land on the horizon. Pure, so the timeline runs under bun test.
export const SKY_WHEEL = 5;
export const SKY_LEAVE = 2.5; // the stream-out is cut off this long after the wheel ends
export const SKY_FADE = 0.8; // stragglers fade over the stream-out's last 0.8s, never vanish at once
export const HORIZON_PERCHES = 9;
const SPLIT: FlockParams = { ...SKY, maxSpeed: 110, maxForce: 200, wHome: 1.6, wAli: 0.8, wCoh: 0.5 };
const SPLIT_AT = 0.2; // seconds: when the halves are chosen and start to part
const SPLIT_SHARE = 0.42; // unequal halves read as natural
// Fast enough to clear the band before the cutoff; SKY alone left most of the flock behind.
const LEAVE: FlockParams = { ...SKY, minSpeed: 70, maxSpeed: 180, maxForce: 260, wHome: 1.6, wAli: 0.7, wCoh: 0.3 };

export interface Sky {
  f: Flock;
  t: number;
  w: number;
  h: number;
  leaving: boolean;
  homes: Homes;
  half: Uint8Array | null; // 0 | 1 per bird, chosen at SPLIT_AT
}

/** Perches must already be set: birds 0–8 land on them. */
export function createSky(f: Flock, w: number, h: number): Sky {
  return { f, t: 0, w, h, leaving: false, homes: { x: new Float32Array(f.n), y: new Float32Array(f.n) }, half: null };
}

const SPLIT_ANGLE = 0.2;

/**
 * Halves are cut by geography, as real flocks part: the 42% of birds furthest back along the split
 * direction go one way. Cutting by index would leave the halves interleaved and the boids hold them.
 */
function chooseHalves(f: Flock): Uint8Array {
  const dx = Math.cos(SPLIT_ANGLE);
  const dy = Math.sin(SPLIT_ANGLE);
  const along = Array.from({ length: f.n }, (_, i) => f.x[i]! * dx + f.y[i]! * dy);
  const cut = [...along].sort((a, b) => a - b)[Math.floor(f.n * SPLIT_SHARE)]!;
  return Uint8Array.from(along, (a) => (a < cut ? 0 : 1));
}

/**
 * The halves follow points either side of a slow, flattened Lissajous (the old single attractor,
 * kept inside the band). They part, swap sides and close up again by 3.7s, leaving 1.3s as one flock.
 */
function splitHomes(s: Sky): void {
  const { t, w, h, homes, half } = s;
  const cx = w / 2 + 0.32 * w * Math.sin(0.11 * t);
  const cy = h / 2 + 0.08 * h * Math.sin(0.17 * t + 1);
  const k = Math.min(1, Math.max(0, (t - SPLIT_AT) / 3.5));
  const sep = 0.28 * w * Math.pow(Math.sin(Math.PI * k), 0.7);
  const ang = SPLIT_ANGLE + 2.4 * k;
  const ox = Math.cos(ang) * sep;
  const oy = Math.sin(ang) * Math.min(sep * 0.45, 0.3 * h);
  for (let i = 0; i < s.f.n; i++) {
    const g = half ? half[i]! * 2 - 1 : 0;
    homes.x[i] = cx + g * ox;
    homes.y[i] = cy + g * oy;
  }
}

/** Advances the sky timeline. Returns false once it's over; then call finishSky. */
export function stepSky(s: Sky, dt: number): boolean {
  s.t += dt;
  const { f, w, h } = s;
  if (s.t < SKY_WHEEL) {
    if (!s.half && s.t >= SPLIT_AT) s.half = chooseHalves(f);
    splitHomes(s);
    step(f, dt, SPLIT, s.homes, { x: 0, y: 0, w, h });
    return true;
  }
  if (!s.leaving) {
    s.leaving = true;
    for (let i = 0; i < HORIZON_PERCHES; i++) land(f, i);
  }
  step(f, dt, LEAVE, { x: 0.7 * w, y: h + 60 }, null);
  return !((dropOutside(f, { x: 0, y: 0, w, h }) === 0 && settled(f)) || s.t > SKY_WHEEL + SKY_LEAVE);
}

/** Opacity for the flying birds: 1, falling to 0 at the cutoff. */
export function skyFade(s: Sky): number {
  return Math.min(1, Math.max(0, (SKY_WHEEL + SKY_LEAVE - s.t) / SKY_FADE));
}

/** Ends the timeline: only the nine horizon birds remain, perched. */
export function finishSky(s: Sky): void {
  for (let i = HORIZON_PERCHES; i < s.f.n; i++) s.f.state[i] = GONE;
  snapToPerches(s.f);
}
