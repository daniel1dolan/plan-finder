import { annualCost, breakpoints } from './cost';
import { TIE_TOLERANCE, type CheapestRange, type PayFrequency, type Plan } from './types';

const EPS = 1e-6;
// Lines crossing at an angle stay within half a cent of each other only over 2 × tolerance / slope
// gap of care cost: at most $1 for whole-percent coinsurance. A tie band that narrow is an artefact
// of the crossing, not a tie. Real ties between near-parallel lines are far wider. Single-plan
// ranges are always real answers, however narrow.
const MIN_TIE_WIDTH = 2;
// The nudge keeps half-cent edges from the tie tolerance rounding up despite float error.
const cents = (x: number) => Math.round(x * 100 + 1e-6) / 100;

export function cheapestPlanIds(plans: Plan[], payFrequency: PayFrequency, careCost: number): string[] {
  const costs = plans.map((p) => annualCost(p, payFrequency, careCost));
  const min = Math.min(...costs);
  return plans.filter((_, i) => costs[i]! - min <= TIE_TOLERANCE + 1e-9).map((p) => p.id);
}

/**
 * Exact lower envelope of piecewise-linear cost lines. Every line is linear between the union of
 * breakpoints and flat after the last one, so the cheapest set can only change where two lines
 * cross or where their gap crosses ±tolerance. Those are the events; probing each open interval
 * between them gives its cheapest set.
 */
export function cheapestRanges(plans: Plan[], payFrequency: PayFrequency): CheapestRange[] {
  if (plans.length === 0) return [];
  const P = [...new Set([0, ...plans.flatMap(breakpoints)])].sort((a, b) => a - b);

  const events = [...P];
  for (let k = 0; k < P.length - 1; k++) {
    const x0 = P[k]!;
    const x1 = P[k + 1]!;
    const c0 = plans.map((p) => annualCost(p, payFrequency, x0));
    const c1 = plans.map((p) => annualCost(p, payFrequency, x1));
    for (let i = 0; i < plans.length; i++) {
      for (let j = i + 1; j < plans.length; j++) {
        for (const gap of [-TIE_TOLERANCE, 0, TIE_TOLERANCE]) {
          const d0 = c0[i]! - c0[j]! - gap;
          const d1 = c1[i]! - c1[j]! - gap;
          if (d0 * d1 < 0) events.push(x0 + ((x1 - x0) * d0) / (d0 - d1));
        }
      }
    }
  }
  events.sort((a, b) => a - b);
  const E = events.filter((x, i) => i === 0 || x - events[i - 1]! > EPS);

  const raw: CheapestRange[] = [];
  for (let k = 0; k < E.length; k++) {
    const from = E[k]!;
    const to = E[k + 1] ?? null;
    pushMerged(raw, { from, to, planIds: cheapestPlanIds(plans, payFrequency, to === null ? from + 1 : (from + to) / 2) });
  }

  // Split each run of crossing tie slivers between its neighbours, at the run's midpoint.
  const sliver = (r: CheapestRange) => r.planIds.length > 1 && r.to !== null && r.to - r.from < MIN_TIE_WIDTH;
  const ranges: CheapestRange[] = [];
  for (let k = 0; k < raw.length; ) {
    let end = k;
    while (sliver(raw[end]!)) end++;
    const next = raw[end]!;
    if (end > k) {
      const prev = ranges.at(-1);
      const split = prev ? (raw[k]!.from + raw[end - 1]!.to!) / 2 : 0;
      if (prev) prev.to = split;
      next.from = split;
    }
    pushMerged(ranges, next);
    k = end + 1;
  }

  // After rounding to cents, drop anything that became zero-width and re-merge.
  const out: CheapestRange[] = [];
  for (const r of ranges) {
    const rounded = { from: cents(r.from), to: r.to === null ? null : cents(r.to), planIds: r.planIds };
    if (rounded.to !== rounded.from) pushMerged(out, rounded);
  }
  return out;
}

function pushMerged(ranges: CheapestRange[], r: CheapestRange) {
  const prev = ranges.at(-1);
  if (prev && prev.planIds.join() === r.planIds.join()) prev.to = r.to;
  else ranges.push({ ...r });
}
