import { expect, test } from 'bun:test';
import { displayName, formatUsd, formatUsdCompact } from './format';

test('F1 formatUsd', () => {
  expect([3500, 8333.333, -1300, -0.001, 0.5].map(formatUsd)).toEqual(['$3,500', '$8,333.33', '-$1,300', '$0', '$0.50']);
});

test('F2 blank names fall back to their position', () => {
  expect(displayName({ name: '  ' }, 2)).toBe('Plan 3');
  expect(displayName({ name: ' Gold ' }, 0)).toBe('Gold');
});

test('compact axis ticks stay short across every value a plan can produce', () => {
  expect([0, 500, 5000, 12500, -1200, 1_500_000, 2e9].map(formatUsdCompact)).toEqual([
    '$0',
    '$500',
    '$5k',
    '$12.5k',
    '-$1.2k',
    '$1.5m',
    '$2b',
  ]);
  // Past billions, compact notation has no shorter unit; exponents stay short.
  expect([3e12, 1.2e20, -1.2e20].map(formatUsdCompact)).toEqual(['$3e12', '$1.2e20', '-$1.2e20']);
});
