import { describe, expect, test } from 'bun:test';
import type { PlanInput } from './types';
import { parseAmount, validatePlan } from './validate';

const filled: PlanInput = {
  id: 'p',
  name: 'P',
  premium: '100',
  deductible: '2000',
  coinsurance: '20',
  oopMax: '4000',
  contributionType: null,
  contribution: '',
};
const v = (over: Partial<PlanInput>) => validatePlan({ ...filled, ...over }, 'P');

describe('validatePlan', () => {
  test('V1 all blank except prefilled coinsurance is incomplete', () => {
    expect(v({ premium: '', deductible: '', oopMax: '' })).toEqual({
      status: 'incomplete',
      missing: ['premium', 'deductible', 'oopMax'],
    });
  });

  test('V2 blank premium', () => {
    expect(v({ premium: '' })).toEqual({ status: 'incomplete', missing: ['premium'] });
  });

  test('V3 blank coinsurance', () => {
    expect(v({ coinsurance: '' })).toEqual({ status: 'incomplete', missing: ['coinsurance'] });
  });

  test('V4 contribution type set, amount blank', () => {
    expect(v({ contributionType: 'hsa', contribution: '' })).toEqual({
      status: 'incomplete',
      missing: ['contribution'],
    });
  });

  test('V5 contribution amount ignored when type is None', () => {
    const r = v({ contributionType: null, contribution: 'abc' });
    expect(r.status).toBe('valid');
    if (r.status === 'valid') expect(r.plan.employerContribution).toBeNull();
  });

  test('V6 non-numeric premium', () => {
    expect(v({ premium: 'abc' })).toEqual({
      status: 'invalid',
      errors: [{ field: 'premium', message: 'Premium must be a number' }],
    });
  });

  test('V7 invalid beats incomplete', () => {
    expect(v({ premium: 'abc', deductible: '' }).status).toBe('invalid');
  });

  test('V8 OOP max below deductible', () => {
    expect(v({ deductible: '2000', oopMax: '1000' })).toEqual({
      status: 'invalid',
      errors: [{ field: 'oopMax', message: "OOP Max can't be less than the deductible" }],
    });
  });

  test('V9 OOP max equal to deductible is fine', () => {
    expect(v({ deductible: '2000', oopMax: '2000' }).status).toBe('valid');
  });

  test('V10 coinsurance out of range', () => {
    for (const c of ['120', '-5']) {
      expect(v({ coinsurance: c })).toEqual({
        status: 'invalid',
        errors: [{ field: 'coinsurance', message: 'Coinsurance must be between 0% and 100%' }],
      });
    }
  });

  test('V11 coinsurance 0, 100 and "20%"', () => {
    for (const [raw, frac] of [['0', 0], ['100', 1], ['20%', 0.2]] as const) {
      const r = v({ coinsurance: raw });
      expect(r.status).toBe('valid');
      if (r.status === 'valid') expect(r.plan.coinsurance).toBeCloseTo(frac, 6);
    }
  });

  test('V12 strips $, commas and whitespace', () => {
    const r = v({ premium: '$1,200.50', deductible: ' 500 ' });
    expect(r.status).toBe('valid');
    if (r.status === 'valid') {
      expect(r.plan.premium).toBe(1200.5);
      expect(r.plan.deductible).toBe(500);
    }
  });

  test('V13 negative premium', () => {
    expect(v({ premium: '-1' })).toEqual({
      status: 'invalid',
      errors: [{ field: 'premium', message: "Premium can't be negative" }],
    });
  });

  test('V14 negative HRA contribution', () => {
    expect(v({ contributionType: 'hra', contribution: '-100' })).toEqual({
      status: 'invalid',
      errors: [{ field: 'contribution', message: "Employer Contribution can't be negative" }],
    });
  });

  test('V15 rejects overflow, multiple dots, lone dot and scientific notation', () => {
    for (const raw of ['1e999', '1.2.3', '.', '1e5']) {
      expect(parseAmount(raw)).toBe('nan');
      expect(v({ premium: raw }).status).toBe('invalid');
    }
  });

  test('V16 trailing and leading dots', () => {
    expect(parseAmount('5.')).toBe(5);
    expect(parseAmount('.5')).toBe(0.5);
  });

  test('valid plan carries display name and contribution', () => {
    const r = validatePlan({ ...filled, contributionType: 'hsa', contribution: '1,000' }, 'Plan 1');
    expect(r).toEqual({
      status: 'valid',
      plan: {
        id: 'p',
        name: 'Plan 1',
        premium: 100,
        deductible: 2000,
        coinsurance: 0.2,
        oopMax: 4000,
        employerContribution: { type: 'hsa', amount: 1000 },
      },
    });
  });
});

describe('parseAmount', () => {
  test('blank is null; % only stripped for percent fields', () => {
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('20%')).toBe('nan');
    expect(parseAmount('20%', { percent: true })).toBe(20);
  });
});
