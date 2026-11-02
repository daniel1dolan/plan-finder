import { describe, expect, test } from 'bun:test';
import { exampleComparison, newPlanInput } from '../comparison';
import { FIELD_MAX, MAX_EXPECTED_CARE_COST, NAME_MAX, PAY_FREQUENCIES, type Comparison, type PlanInput } from '../engine/types';
import { decodeComparison, encodeComparison, payloadFromHash } from './codec';

const strip = (c: Comparison | null) => c && { ...c, plans: c.plans.map(({ id: _id, ...rest }) => rest) };
const roundTrip = (c: Comparison) => expect(strip(decodeComparison(encodeComparison(c)))).toEqual(strip(c));
const p = (over: Partial<PlanInput>): PlanInput => ({ ...newPlanInput('P'), ...over });
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const body = (value: unknown) => `1.${b64url(new TextEncoder().encode(JSON.stringify(value)))}`;
const okPlan = ['A', '1', '2', '20', '3', '', ''];
/** Valid payloads padded with JSON whitespace: the last one within 6000 chars and the first past it. */
const [underLimit, overLimit] = (() => {
  const json = JSON.stringify(['m', null, [okPlan]]);
  let under = '';
  for (let pad = 0; ; pad++) {
    const s = `1.${b64url(new TextEncoder().encode(json + ' '.repeat(pad)))}`;
    if (s.length > 6000) return [under, s];
    under = s;
  }
})();

describe('share codec', () => {
  test('K1 example round-trips', () => roundTrip(exampleComparison()));

  test('K2 frequencies, expected care cost, contributions and raw strings round-trip', () => {
    for (const payFrequency of PAY_FREQUENCIES) {
      for (const expectedCareCost of [null, 0, 1234.5]) {
        roundTrip({
          payFrequency,
          expectedCareCost,
          plans: [
            p({ contributionType: 'hsa', contribution: '1000' }),
            p({ contributionType: 'hra', contribution: '500' }),
            p({ premium: 'abc', deductible: '', coinsurance: '', contribution: 'kept while None' }),
          ],
        });
      }
    }
  });

  test('K3 unicode and maximum-length names', () => {
    roundTrip({ payFrequency: 'monthly', expectedCareCost: null, plans: [p({ name: 'Café 🌿 plan' }), p({ name: 'x'.repeat(60) })] });
  });

  test('K4 six plans', () => {
    roundTrip({ payFrequency: 'weekly', expectedCareCost: 9, plans: Array.from({ length: 6 }, (_, i) => p({ name: `P${i}` })) });
  });

  test('the largest values every input accepts still round-trip', () => {
    const fill = (name: string, field: string): Comparison => ({
      payFrequency: 'biweekly',
      expectedCareCost: MAX_EXPECTED_CARE_COST,
      plans: Array.from({ length: 6 }, () =>
        p({ name, premium: field, deductible: field, coinsurance: field, oopMax: field, contributionType: 'hra', contribution: field }),
      ),
    });
    roundTrip(fill('x'.repeat(NAME_MAX), '9'.repeat(FIELD_MAX)));
    roundTrip(fill('漢'.repeat(NAME_MAX), '"'.repeat(FIELD_MAX))); // most bytes per character
    expect(decodeComparison(encodeComparison({ ...exampleComparison(), expectedCareCost: MAX_EXPECTED_CARE_COST + 1 }))).toBeNull();
  });

  test('K6 golden v1 payload keeps decoding', () => {
    const golden =
      '1.WyJtIiw1MDAwLFtbIkxvdyBkZWR1Y3RpYmxlIiwiMjAwIiwiMjAwMCIsIjIwIiwiNDAwMCIsIiIsIiJdLFsiSGlnaCBkZWR1Y3RpYmxlIiwiMTAwIiwiNzAwMCIsIjIwIiwiMTAwMDAiLCIiLCIiXV1d';
    expect(encodeComparison(exampleComparison())).toBe(golden);
    expect(strip(decodeComparison(golden))).toEqual(strip(exampleComparison()));
  });

  test('K7 garbage decodes to null', () => {
    const valid = encodeComparison(exampleComparison());
    const garbage = [
      '',
      '1.',
      '1.!!!',
      'abc',
      `2.${valid.slice(2)}`,
      body({}),
      `1.${b64url(new Uint8Array([0xff, 0xfe, 0xfd]))}`,
      body(['m', null, []]),
      body(['m', null, Array(7).fill(okPlan)]),
      body(['m', null, [okPlan.slice(0, 6)]]),
      body(['m', null, [['A', 1, '2', '20', '3', '', '']]]),
      body(['x', null, [okPlan]]),
      body(['m', -1, [okPlan]]),
      body(['m', '5', [okPlan]]),
      body(['m', 1e10, [okPlan]]),
      body(['m', null, [['x'.repeat(61), ...okPlan.slice(1)]]]),
      body(['m', null, [['A', '1'.repeat(21), '2', '20', '3', '', '']]]),
      body(['m', null, [['A', '1', '2', '20', '3', 'fsa', '']]]),
      body(['m', null, [okPlan], 'extra']),
      overLimit,
    ];
    expect(decodeComparison(underLimit)).not.toBeNull(); // padding alone is fine; only the length rejects
    expect(decodeComparison(body(['m', null, [okPlan]]))).not.toBeNull();
    for (const g of garbage) expect(decodeComparison(g)).toBeNull();
  });

  test('K8 fuzzed input never throws', () => {
    let seed = 42;
    const next = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const alphabets = [
      Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join(''),
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
    ];
    for (let n = 0; n < 2000; n++) {
      const alphabet = alphabets[n % 2]!;
      let s = n % 4 < 2 ? '1.' : '';
      const len = Math.floor(next() * 200);
      for (let i = 0; i < len; i++) s += alphabet[Math.floor(next() * alphabet.length)];
      expect(() => decodeComparison(s)).not.toThrow();
    }
  });

  test('K9 payloadFromHash', () => {
    expect(['#c=1.abc', 'c=1.abc', '', '#x=1', '#c='].map(payloadFromHash)).toEqual(['1.abc', '1.abc', null, null, null]);
  });
});
