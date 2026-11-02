import { describe, expect, test } from 'bun:test';
import { cheapestRanges } from './engine/envelope';
import { A, B, plan } from './engine/testPlans';
import type { PayFrequency, Plan } from './engine/types';
import { cheapestRangeSentence, notChartedSentence } from './summary';

const sentence = (plans: Plan[], pf: PayFrequency = 'monthly') =>
  cheapestRangeSentence(cheapestRanges(plans, pf), plans, pf);
const low = { ...A, name: 'Low deductible' };
const high = { ...B, name: 'High deductible' };

describe('cheapestRangeSentence', () => {
  test('S1 example', () => {
    expect(sentence([low, high])).toBe(
      'High deductible is cheapest up to $3,500 of care cost; Low deductible is cheapest from $3,500 on.',
    );
  });

  test('S2 flat open-ended tie names its cost', () => {
    expect(sentence([plan('X', 1200, 1000, 0, 1000), plan('Y', 2200, 0, 0, 0)], 'annual')).toBe(
      'X is cheapest up to $1,000 of care cost; X and Y are tied for cheapest at $2,200 from $1,000 on.',
    );
  });

  test('S3 middle range', () => {
    const C = plan('C', 150, 3000, 20, 6000, ['hra', 1000]);
    expect(sentence([A, B, C])).toBe(
      'B is cheapest up to $600 of care cost; C is cheapest from $600 to $16,000; A is cheapest from $16,000 on.',
    );
  });

  test('S4 sloped tie has no cost', () => {
    expect(sentence([A, { ...A, id: 'A2', name: 'A2' }])).toBe('A and A2 are tied for cheapest at every care cost.');
  });

  test('S5 single plan', () => {
    expect(sentence([low])).toBe(
      'Low deductible is the only plan charted; its annual cost runs from $2,400 to $6,400.',
    );
  });

  test('S6 no valid plans', () => {
    expect(sentence([])).toBe("Fill in a plan's premium, deductible and OOP max to see results.");
  });

  test('S7 three tied names', () => {
    const tied = ['A', 'B', 'C'].map((id) => ({ ...A, id, name: id }));
    expect(sentence(tied)).toBe('A, B, and C are tied for cheapest at every care cost.');
  });
});

describe('notChartedSentence', () => {
  test('S8 lists incomplete and invalid plans', () => {
    expect(
      notChartedSentence([
        { name: 'Plan C', status: 'incomplete' },
        { name: 'Plan D', status: 'invalid' },
      ]),
    ).toBe('Not charted: Plan C (incomplete), Plan D (invalid).');
    expect(notChartedSentence([])).toBeNull();
  });
});
