'use client';

import { createRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  HORIZON_PERCHES,
  ROOST,
  SKY_WHEEL,
  createFlock,
  createSky,
  finishSky,
  land,
  liftOff,
  paths,
  setPerches,
  settled,
  skyFade,
  snapToPerches,
  step,
  stepSky,
  type Flock,
  type Sky,
} from '@/flock';
import { useMedia } from './useMedia';

const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');

/**
 * Runs rAF only while tick() returns true, so a settled page runs no frames at all. Stops when the
 * tab hides; onResume decides whether to restart when it comes back.
 */
function useFlockLoop(tick: (dt: number) => boolean, onResume: () => boolean) {
  const handlers = useRef({ tick, onResume });
  useEffect(() => {
    handlers.current = { tick, onResume };
  });
  const raf = useRef(0);
  const running = useRef(false);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    running.current = false;
  }, []);

  const start = useCallback(() => {
    if (running.current || document.hidden) return;
    running.current = true;
    let last = 0;
    const frame = (t: number) => {
      const dt = last ? Math.min((t - last) / 1000, 1 / 30) : 1 / 60;
      last = t;
      if (handlers.current.tick(dt)) raf.current = requestAnimationFrame(frame);
      else running.current = false;
    };
    raf.current = requestAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) stop();
      else if (handlers.current.onResume()) start();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, [start, stop]);

  return { start, stop };
}

type PathRefs = {
  near: React.RefObject<SVGPathElement | null>;
  far: React.RefObject<SVGPathElement | null>;
  perched: React.RefObject<SVGPathElement | null>;
};
function usePathRefs(): PathRefs {
  return useState(() => ({ near: createRef<SVGPathElement>(), far: createRef<SVGPathElement>(), perched: createRef<SVGPathElement>() }))[0];
}
// Three paths, so a frame is three setAttribute calls and no React render.
function draw(f: Flock, el: PathRefs, scale = 1) {
  const p = paths(f, scale, performance.now() / 1000);
  el.near.current?.setAttribute('d', p.near);
  el.far.current?.setAttribute('d', p.far);
  el.perched.current?.setAttribute('d', p.perched);
}

function BirdPaths({ near, far, perched }: PathRefs) {
  return (
    <>
      <path ref={far} fill="var(--color-bird)" fillOpacity={0.34} />
      <path ref={near} fill="var(--color-bird)" fillOpacity={0.72} />
      <path ref={perched} fill="var(--color-bird)" fillOpacity={0.8} />
    </>
  );
}

// The chart flock arrives as the sky flock streams out toward it (D4), timed from page load
// rather than signalled, so nothing can leave it waiting.
const ROOST_ARRIVES_AT_MS = SKY_WHEEL * 1000 + 700;

/** The intro's murmuration: splits and rejoins for 5s, streams out, leaves nine birds on the horizon. */
export function SkyMurmuration({ className }: { className?: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const refs = usePathRefs();
  const reduced = useReducedMotion();
  const sim = useRef<(Sky & { done: boolean }) | null>(null);
  const inView = useRef(false);

  const finish = useCallback(() => {
    const s = sim.current;
    if (!s) return;
    finishSky(s);
    draw(s.f, refs);
    s.done = true;
  }, [refs]);

  const tick = useCallback(
    (dt: number) => {
      const s = sim.current;
      if (!s || s.done) return false;
      if (!stepSky(s, dt)) {
        finish();
        return false;
      }
      draw(s.f, refs);
      const fade = String(skyFade(s));
      refs.near.current?.style.setProperty('opacity', fade);
      refs.far.current?.style.setProperty('opacity', fade);
      return true;
    },
    [finish, refs],
  );

  const { start, stop } = useFlockLoop(tick, () => inView.current && !!sim.current && !sim.current.done);

  useEffect(() => {
    const el = svg.current;
    if (reduced === null || !el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const bandW = el.parentElement?.clientWidth ?? w;
    const n = innerWidth < 768 ? 80 : 150;
    const f = createFlock(n, 20261101, w * 0.6, h * 0.5, 30);
    // Nine perches spaced evenly along the right 30% of the horizon, wider on narrow bands so the
    // birds don't touch.
    const x0 = w - Math.max(bandW * 0.3, HORIZON_PERCHES * 22) + 12;
    const xs = Array.from({ length: n }, (_, i) => x0 + ((w - 24 - x0) * Math.min(i, HORIZON_PERCHES - 1)) / (HORIZON_PERCHES - 1));
    setPerches(f, xs, Array.from({ length: n }, () => h - 0.5)); // feet on the horizon hairline
    sim.current = { ...createSky(f, w, h), done: false };

    if (reduced) {
      finish();
      return;
    }
    // Paused while less than 10% visible; paused time doesn't count toward the timeline.
    const io = new IntersectionObserver(
      ([e]) => {
        inView.current = !!e && e.intersectionRatio >= 0.1;
        if (sim.current?.done) return;
        if (inView.current) start();
        else stop();
      },
      { threshold: [0, 0.1] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      stop();
    };
  }, [reduced, start, stop, finish]);

  return (
    <svg ref={svg} aria-hidden="true" focusable="false" className={className} style={{ pointerEvents: 'none', overflow: 'visible' }}>
      {reduced !== null && <BirdPaths {...refs} />}
    </svg>
  );
}

type Plot = { x: number; y: number; width: number; height: number };
type Seq = { kind: 'arrive' | 'reroost'; t: number; order: number[]; landed: number } | null;

const ARRIVE_FLIGHT = 1.3;
const REROOST_FLIGHT = 0.9;
const STAGGER = 0.07; // ≈0.7s for the row to settle, left to right
const ROOST_SCALE = 1; // ≈12px birds: a few clear silhouettes, not a dashed line shadowing the plan

/** Birds roosting along the cheapest line. Each change of answer lifts and resettles them. */
export function RoostFlock({ perchAt, signature, plot }: { perchAt: (t: number) => { x: number; y: number }; signature: string; plot: Plot }) {
  const g = useRef<SVGGElement>(null);
  const refs = usePathRefs();
  const reduced = useReducedMotion();
  // A handful of birds spaced along the axis, so they read as birds rather than a dashed line. The
  // count is fixed at mount, so a resize across 480px snaps instead of replaying the arrival.
  const [n] = useState(() => (plot.width < 480 ? 8 : 10));
  const perches = Array.from({ length: n }, (_, i) => perchAt((i + 0.5) / n));
  const flock = useRef<Flock | null>(null);
  const seq = useRef<Seq>(null);
  const roostedSig = useRef<string | null>(null);
  const latest = useRef({ perches, signature, plot });
  const lastPlot = useRef<Plot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    latest.current = { perches, signature, plot };
  });

  const applyPerches = (f: Flock) => {
    const p = latest.current.perches;
    setPerches(f, p.map((q) => q.x), p.map((q) => q.y));
  };

  const tick = (dt: number) => {
    const f = flock.current;
    if (!f) return false;
    const s = seq.current;
    const { plot: p } = latest.current;
    let home = { x: p.x + p.width / 2, y: p.y + p.height * 0.3 };
    if (s) {
      s.t += dt;
      const flight = s.kind === 'arrive' ? ARRIVE_FLIGHT : REROOST_FLIGHT;
      if (s.kind === 'arrive') {
        // Glide the attractor from just above the top-right of the plot toward its upper middle.
        const k = Math.min(1, s.t / flight);
        home = { x: p.x + p.width - 60 + (60 - p.width / 2) * k, y: p.y - 12 + (p.height * 0.3 + 12) * k };
      } else {
        let cx = 0;
        let cy = 0;
        for (let i = 0; i < f.n; i++) {
          cx += f.tx[i]!;
          cy += f.ty[i]!;
        }
        home = { x: cx / f.n, y: cy / f.n - 30 };
      }
      if (s.t >= flight) {
        // Land left to right, 14ms apart.
        if (s.order.length === 0) s.order = Array.from({ length: f.n }, (_, i) => i).sort((a, b) => f.tx[a]! - f.tx[b]!);
        const due = Math.min(f.n, Math.floor((s.t - flight) / STAGGER) + 1);
        while (s.landed < due) land(f, s.order[s.landed++]!);
      }
    }
    step(f, dt, ROOST, home, { x: p.x - 20, y: p.y - 40, w: p.width + 40, h: p.height + 60 });
    draw(f, refs, ROOST_SCALE);
    if (settled(f)) {
      seq.current = null;
      return false;
    }
    return true;
  };

  const snap = () => {
    const f = flock.current;
    if (!f) return;
    applyPerches(f);
    snapToPerches(f);
    seq.current = null;
    roostedSig.current = latest.current.signature;
    draw(f, refs, ROOST_SCALE);
  };

  const { start } = useFlockLoop(tick, () => {
    snap();
    return false;
  });

  // Arrive once the chart is 40% visible and the sky flock has had time to stream out.
  useEffect(() => {
    const svg = g.current?.ownerSVGElement;
    if (!svg) return;
    let visible = false;
    let timeUp = performance.now() >= ROOST_ARRIVES_AT_MS;
    const check = () => visible && timeUp && setReady(true);
    const t = setTimeout(() => {
      timeUp = true;
      check();
    }, ROOST_ARRIVES_AT_MS - performance.now());
    const io = new IntersectionObserver(
      ([e]) => {
        visible = !!e && e.intersectionRatio >= 0.4;
        check();
      },
      { threshold: [0, 0.4] },
    );
    io.observe(svg);
    return () => {
      clearTimeout(t);
      io.disconnect();
    };
  }, [reduced]); // the <g> only exists once reduced motion is known

  useEffect(() => {
    if (reduced === null) return;
    let f = flock.current;
    if (!f) {
      if (reduced) {
        flock.current = createFlock(n, 7, 0, 0, 0);
        snap();
        return;
      }
      if (!ready) return;
      f = flock.current = createFlock(n, 7, plot.x + plot.width - 60, plot.y - 12, 20);
      for (let i = 0; i < n; i++) {
        f.vx[i] = -60 + f.vx[i]! * 0.2;
        f.vy[i] = 20 + f.vy[i]! * 0.2;
      }
      applyPerches(f);
      seq.current = { kind: 'arrive', t: 0, order: [], landed: 0 };
      roostedSig.current = signature;
      lastPlot.current = plot;
      start();
      return;
    }

    const lp = lastPlot.current;
    lastPlot.current = plot;
    if (reduced || (lp && (lp.width !== plot.width || lp.height !== plot.height))) {
      snap();
      return;
    }
    if (seq.current) {
      applyPerches(f); // mid-flight: retarget, never restart
      return;
    }
    // Debounced: a changed answer re-roosts after 700ms; moved perches hop after 250ms.
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        const fl = flock.current;
        if (!fl) return;
        applyPerches(fl);
        if (latest.current.signature !== roostedSig.current) {
          roostedSig.current = latest.current.signature;
          liftOff(fl);
          seq.current = { kind: 'reroost', t: 0, order: [], landed: 0 };
        }
        start();
      },
      signature !== roostedSig.current ? 700 : 250,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- perches/plot are new objects each render; their digest and dims decide
  }, [reduced, ready, signature, perchKey(perches), plot.x, plot.y, plot.width, plot.height]);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (reduced === null) return null;
  return (
    <g ref={g} aria-hidden="true" pointerEvents="none">
      <BirdPaths {...refs} />
    </g>
  );
}

const perchKey = (p: { x: number; y: number }[]) => p.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
