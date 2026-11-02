import { expect, test } from 'bun:test';
import { blankComparison, exampleComparison } from '../comparison';
import { encodeComparison } from './codec';
import { loadInitialComparison } from './load';
import { AUTOSAVE_KEY } from './storage';

const fakeStore = (initial: Record<string, string> = {}) => ({ getItem: (k: string) => initial[k] ?? null });
const shared = { ...blankComparison(), payFrequency: 'weekly' as const };
const saved = exampleComparison();
const savedStore = () => fakeStore({ [AUTOSAVE_KEY]: encodeComparison(saved) });

test('L1 share link wins', () => {
  const r = loadInitialComparison(`#c=${encodeComparison(shared)}`, savedStore());
  expect(r.source).toBe('share');
  expect(r.shareLinkFailed).toBe(false);
  expect(r.comparison.payFrequency).toBe('weekly');
});

test('L2 broken share link falls back to the auto-save and flags it', () => {
  const r = loadInitialComparison('#c=1.garbage!!', savedStore());
  expect(r).toMatchObject({ source: 'autosave', shareLinkFailed: true });
  expect(r.comparison.plans.map((p) => p.name)).toEqual(['Low deductible', 'High deductible']);
});

test('L3 no hash uses the auto-save', () => {
  expect(loadInitialComparison('', savedStore())).toMatchObject({ source: 'autosave', shareLinkFailed: false });
});

test('L4 nothing usable gives the example', () => {
  for (const store of [fakeStore(), fakeStore({ [AUTOSAVE_KEY]: 'junk' })]) {
    const r = loadInitialComparison('', store);
    expect(r).toMatchObject({ source: 'example', shareLinkFailed: false });
    expect(r.comparison.expectedCareCost).toBe(5000);
  }
  expect(loadInitialComparison('#c=2.abcd', fakeStore())).toMatchObject({ source: 'example', shareLinkFailed: true });
});

test('L5 loading never writes', () => {
  let writes = 0;
  const spy = { ...savedStore(), setItem: () => void writes++ };
  for (const hash of ['', '#c=bad', `#c=${encodeComparison(shared)}`]) loadInitialComparison(hash, spy);
  expect(writes).toBe(0);
});
