import { describe, expect, test } from 'bun:test';
import { crossoverMarkers } from './chart';
import { cheapestPlanIds, cheapestRanges } from './envelope';
import { A, B, plan } from './testPlans';
import type { PayFrequency, Plan } from './types';

const r = (from: number, to: number | null, ...planIds: string[]) => ({ from, to, planIds });
const check = (plans: Plan[], pf: PayFrequency, ranges: ReturnType<typeof r>[], crossovers: number[]) => {
  const got = cheapestRanges(plans, pf);
  expect(got).toEqual(ranges);
  expect(crossoverMarkers(got, plans, pf).map((m) => m.careCost)).toEqual(crossovers);
};
const C = plan('C', 150, 3000, 20, 6000, ['hsa', 1000]);

describe('cheapestRanges', () => {
  test('R1 example, monthly', () => check([A, B], 'monthly', [r(0, 3500, 'B'), r(3500, null, 'A')], [3500]));
  test('R2 weekly', () => check([A, B], 'weekly', [r(0, 18000, 'B'), r(18000, null, 'A')], [18000]));
  test('R3 biweekly', () => check([A, B], 'biweekly', [r(0, 5250, 'B'), r(5250, null, 'A')], [5250]));
  test('R4 semi-monthly crossover sits on a breakpoint', () =>
    check([A, B], 'semi-monthly', [r(0, 5000, 'B'), r(5000, null, 'A')], [5000]));
  test('R5 annual', () => check([A, B], 'annual', [r(0, 2125, 'B'), r(2125, null, 'A')], [2125]));
  test('R6 B premium $150/mo', () =>
    check([A, { ...B, premium: 150 }], 'monthly', [r(0, 2750, 'B'), r(2750, null, 'A')], [2750]));
  test('R7 HSA third plan', () =>
    check([A, B, C], 'monthly', [r(0, 16000, 'C'), r(16000, null, 'A')], [16000]));
  test('R8 HRA third plan', () => {
    const hra = { ...C, employerContribution: { type: 'hra' as const, amount: 1000 } };
    check([A, B, hra], 'monthly', [r(0, 600, 'B'), r(600, 16000, 'C'), r(16000, null, 'A')], [600, 16000]);
  });
  test('R9 single plan', () => check([A], 'monthly', [r(0, null, 'A')], []));
  test('R10 no plans', () => check([], 'monthly', [], []));
  test('R11 identical plans tie everywhere', () =>
    check([A, { ...A, id: 'A2' }], 'monthly', [r(0, null, 'A', 'A2')], []));
  test('R12 partial overlap becomes an open-ended tie', () => {
    const X = plan('X', 1200, 1000, 0, 1000);
    const Y = plan('Y', 2200, 0, 0, 0);
    check([X, Y], 'annual', [r(0, 1000, 'X'), r(1000, null, 'X', 'Y')], [1000]);
  });
  test('R13 lines touching at one point make no crossover', () => {
    const T1 = plan('T1', 0, 1000, 20, 10000);
    const T2 = plan('T2', 500, 0, 50, 10000);
    check([T1, T2], 'annual', [r(0, null, 'T1')], []);
  });
  test('R14 within half a cent is a tie', () =>
    check([plan('A', 1000.004, 0, 0, 0), plan('B', 1000, 0, 0, 0)], 'annual', [r(0, null, 'A', 'B')], []));
  test('R15 just outside half a cent is not', () =>
    check([plan('A', 1000.006, 0, 0, 0), plan('B', 1000, 0, 0, 0)], 'annual', [r(0, null, 'B')], []));
  test('R16 three lines through one point', () => {
    const X = plan('X', 0, 0, 100, 10000);
    const Y = plan('Y', 1000, 0, 0, 0);
    const Z = plan('Z', 500, 0, 50, 10000);
    check([X, Y, Z], 'annual', [r(0, 1000, 'X'), r(1000, null, 'Y')], [1000]);
  });
  test('R17 six-plan staircase', () => {
    const F = [
      plan('F1', 0, 0, 100, 5000),
      plan('F2', 200, 0, 80, 5000),
      plan('F3', 600, 0, 60, 5000),
      plan('F4', 1200, 0, 40, 5000),
      plan('F5', 2000, 0, 20, 5000),
      plan('F6', 3000, 0, 0, 0),
    ];
    check(
      F,
      'annual',
      [
        r(0, 1000, 'F1'),
        r(1000, 2000, 'F2'),
        r(2000, 3000, 'F3'),
        r(3000, 4000, 'F4'),
        r(4000, 5000, 'F5'),
        r(5000, null, 'F6'),
      ],
      [1000, 2000, 3000, 4000, 5000],
    );
  });
  test('near-coincident crossings leave no sliver ranges or duplicate crossovers', () => {
    const X = plan('X', 0, 0, 100, 10000);
    const Y = plan('Y', 1000, 0, 0, 0);
    const Z = plan('Z', 500.002, 0, 50, 10000);
    check([X, Y, Z], 'annual', [r(0, 1000, 'X'), r(1000, null, 'Y')], [1000]);
  });
  test('near-parallel lines tie over the band where they stay within half a cent', () => {
    // B - A = -0.1 + 0.0001x: within half a cent from 950 to 1050, then A, until A flattens past B.
    const A1 = plan('A', 100, 0, 20, 100000);
    const B1 = plan('B', 99.9, 0, 20.01, 100000);
    const ranges = cheapestRanges([A1, B1], 'annual');
    expect(ranges.map((x) => x.planIds)).toEqual([['B'], ['A', 'B'], ['A'], ['B']]);
    expect(ranges.slice(0, 3).map((x) => [x.from, x.to])).toEqual([[0, 950], [950, 1050], [1050, 499999.5]]);
    // A plan that is never cheapest must not change the answer.
    const C1 = plan('C', 99999, 1010, 20, 100000);
    expect(cheapestRanges([A1, B1, C1], 'annual')).toEqual(ranges);
  });
  test('a narrow single-plan range is a real answer and is kept', () => {
    // Low costs min(x, 1000), High a flat $2: Low is cheaper below $2 of care.
    const low = plan('Low', 0, 1000, 100, 1000);
    const high = plan('High', 2, 0, 0, 0);
    check([low, high], 'annual', [r(0, 2, 'Low'), r(2, null, 'High')], [2]);
    expect(cheapestPlanIds([low, high], 'annual', 0)).toEqual(['Low']);
  });
  test('R18 tied sets keep input order', () => {
    expect(cheapestRanges([{ ...A, id: 'A2' }, A], 'monthly')).toEqual([r(0, null, 'A2', 'A')]);
  });
});

describe('cheapestPlanIds', () => {
  test('R19 tie at the semi-monthly crossover', () => {
    expect(cheapestPlanIds([A, B], 'semi-monthly', 5000)).toEqual(['A', 'B']);
  });
  test('single cheapest away from a crossover', () => {
    expect(cheapestPlanIds([A, B], 'monthly', 1000)).toEqual(['B']);
  });
});
