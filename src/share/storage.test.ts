import { expect, test } from 'bun:test';
import { exampleComparison } from '../comparison';
import { AUTOSAVE_KEY, loadAutoSave, saveAutoSave } from './storage';

function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

test('P1 save then load round-trips', () => {
  const store = fakeStore();
  saveAutoSave(store, exampleComparison());
  expect(store.data.get(AUTOSAVE_KEY)).toMatch(/^1\./);
  expect(loadAutoSave(store)?.plans.map((p) => p.name)).toEqual(['Low deductible', 'High deductible']);
});

test('P2 throwing stores are tolerated', () => {
  const boom = () => {
    throw new Error('denied');
  };
  expect(loadAutoSave({ getItem: boom })).toBeNull();
  expect(() => saveAutoSave({ setItem: boom }, exampleComparison())).not.toThrow();
  expect(loadAutoSave(fakeStore())).toBeNull();
});
