import { describe, expect, test } from 'bun:test';
import {
  annualCost,
  breakpoints,
  contributionOffset,
  costBreakdown,
  outOfPocketSpend,
  worstCaseCost,
} from './cost';
import { A, B, plan } from './testPlans';
import type { Plan } from './types';

const costsAt = (p: Plan, xs: number[]) => xs.map((x) => annualCost(p, 'monthly', x));
const expectClose = (actual: number[], expected: number[]) => {
  expect(actual.length).toBe(expected.length);
  actual.forEach((a, i) => expect(a).toBeCloseTo(expected[i]!, 6));
};

describe('cost', () => {
  const points = [0, 2000, 3500, 5000, 7000, 12000, 22000];
  test('C2 example A annual cost', () => {
    expectClose(costsAt(A, points), [2400, 4400, 4700, 5000, 5400, 6400, 6400]);
  });

  test('C3 example B annual cost', () => {
    expectClose(costsAt(B, points), [1200, 3200, 4700, 6200, 8200, 9200, 11200]);
  });

  test('C4 example A spend, worst case, breakpoints', () => {
    expect(outOfPocketSpend(A, 5000)).toBeCloseTo(2600, 6);
    expect(worstCaseCost(A, 'monthly')).toBeCloseTo(6400, 6);
    expect(breakpoints(A)).toEqual([2000, 12000]);
  });

  test('C5 example B worst case, breakpoints', () => {
    expect(worstCaseCost(B, 'monthly')).toBeCloseTo(11200, 6);
    expect(breakpoints(B)).toEqual([7000, 22000]);
  });

  const hsa = plan('H', 150, 3000, 20, 6000, ['hsa', 1000]);
  test('C6 HSA offsets in full', () => {
    expectClose(costsAt(hsa, [0, 500, 2000, 5000, 18000, 30000]), [800, 1300, 2800, 4200, 6800, 6800]);
    expect(worstCaseCost(hsa, 'monthly')).toBeCloseTo(6800, 6);
    expect(breakpoints(hsa)).toEqual([3000, 18000]);
  });

  test('C7 HSA larger than costs goes negative', () => {
    expect(annualCost(plan('H', 100, 3000, 20, 6000, ['hsa', 2500]), 'monthly', 0)).toBeCloseTo(-1300, 6);
  });

  const hra = plan('R', 150, 3000, 20, 6000, ['hra', 1000]);
  test('C8 HRA offsets up to spend', () => {
    expectClose(costsAt(hra, [0, 500, 1000, 2000, 5000, 18000]), [1800, 1800, 1800, 2800, 4200, 6800]);
    expect(contributionOffset(hra, outOfPocketSpend(hra, 500))).toBeCloseTo(500, 6);
    expect(breakpoints(hra)).toEqual([1000, 3000, 18000]);
    expect(worstCaseCost(hra, 'monthly')).toBeCloseTo(6800, 6);
  });

  test('C9 HRA above the deductible', () => {
    const p = plan('R', 150, 3000, 20, 6000, ['hra', 4000]);
    expectClose(costsAt(p, [5000, 8000, 10000, 18000]), [1800, 1800, 2200, 3800]);
    expect(breakpoints(p)).toEqual([3000, 8000, 18000]);
    expect(worstCaseCost(p, 'monthly')).toBeCloseTo(3800, 6);
  });

  test('C10 HRA at or above OOP max', () => {
    const p = plan('R', 150, 3000, 20, 6000, ['hra', 7000]);
    expectClose(costsAt(p, [0, 10000, 30000]), [1800, 1800, 1800]);
    expect(breakpoints(p)).toEqual([3000, 18000]);
    expect(worstCaseCost(p, 'monthly')).toBeCloseTo(1800, 6);
  });

  test('C11 0% coinsurance flattens at the deductible', () => {
    const p = plan('Z', 100, 1500, 0, 5000);
    expectClose(costsAt(p, [1000, 1500, 50000]), [2200, 2700, 2700]);
    expect(breakpoints(p)).toEqual([1500]);
    expect(worstCaseCost(p, 'monthly')).toBeCloseTo(2700, 6);
  });

  test('C12 100% coinsurance', () => {
    const p = plan('F', 100, 1000, 100, 3000);
    expectClose(costsAt(p, [500, 2000, 3000, 9000]), [1700, 3200, 4200, 4200]);
    expect(breakpoints(p)).toEqual([1000, 3000]);
  });

  test('C13 $0 deductible excludes 0 from breakpoints', () => {
    const p = plan('D', 300, 0, 10, 2000);
    expectClose(costsAt(p, [5000, 20000, 30000]), [4100, 5600, 5600]);
    expect(breakpoints(p)).toEqual([20000]);
  });

  test('C14 all-zero plan is constant', () => {
    const p = plan('K', 3000, 0, 0, 0);
    for (const x of [0, 100, 1e6]) expect(annualCost(p, 'annual', x)).toBeCloseTo(3000, 6);
    expect(breakpoints(p)).toEqual([]);
  });

  test('C15 cost breakdown', () => {
    const a = costBreakdown(A, 'monthly', 5000);
    expectClose(
      [a.annualPremium, a.outOfPocketSpend, a.contributionOffset, a.annualCost, a.worstCaseCost],
      [2400, 2600, 0, 5000, 6400],
    );
    const h = costBreakdown(hsa, 'monthly', 5000);
    expectClose(
      [h.annualPremium, h.outOfPocketSpend, h.contributionOffset, h.annualCost, h.worstCaseCost],
      [1800, 3400, 1000, 4200, 6800],
    );
  });
});
