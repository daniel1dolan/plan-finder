import { describe, expect, test } from 'bun:test';
import { addPlan, blankComparison, exampleComparison, removePlan, updatePlan } from './comparison';
import { validatePlan } from './engine/validate';

describe('comparison', () => {
  test('M1 example comparison', () => {
    const c = exampleComparison();
    expect(c.payFrequency).toBe('monthly');
    expect(c.expectedCareCost).toBe(5000);
    const plans = c.plans.map((p) => {
      const s = validatePlan(p, p.name);
      if (s.status !== 'valid') throw new Error('example plan not valid');
      const { id: _id, ...rest } = s.plan;
      return rest;
    });
    expect(plans).toEqual([
      { name: 'Low deductible', premium: 200, deductible: 2000, coinsurance: 0.2, oopMax: 4000, employerContribution: null },
      { name: 'High deductible', premium: 100, deductible: 7000, coinsurance: 0.2, oopMax: 10000, employerContribution: null },
    ]);
  });

  test('M2 addPlan names the next unused letter, prefills coinsurance and stops at six', () => {
    let c = exampleComparison();
    for (let i = 0; i < 5; i++) c = addPlan(c);
    expect(c.plans.map((p) => p.name)).toEqual(['Low deductible', 'High deductible', 'Plan A', 'Plan B', 'Plan C', 'Plan D']);
    expect(c.plans[2]).toMatchObject({ premium: '', deductible: '', coinsurance: '20', oopMax: '', contributionType: null });
    expect(new Set(c.plans.map((p) => p.id)).size).toBe(6);
    expect(addPlan(c)).toBe(c);

    const b = blankComparison();
    const renamed = updatePlan(b, { ...b.plans[0]!, name: 'Plan B' });
    expect(addPlan(renamed).plans.map((p) => p.name)).toEqual(['Plan B', 'Plan A']);
  });

  test('M3 removePlan keeps at least one plan', () => {
    const b = blankComparison();
    expect(removePlan(b, b.plans[0]!.id)).toBe(b);
    const two = addPlan(b);
    expect(removePlan(two, two.plans[0]!.id).plans.map((p) => p.name)).toEqual(['Plan B']);
  });
});
