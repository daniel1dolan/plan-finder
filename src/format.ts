import type { PlanInput } from './engine/types';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  trailingZeroDisplay: 'stripIfInteger',
  signDisplay: 'negative', // so -0.001 reads "$0", not "-$0"
});

export const formatUsd = (v: number): string => usd.format(v);

const compactUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

/** Axis ticks: "$12.5k", "$1.5m", "$2b"; past that, compact notation has no shorter unit, so "$1.2e20". */
export function formatUsdCompact(v: number): string {
  if (Math.abs(v) < 1e12) return compactUsd.format(v).replace(/[KMB]$/, (u) => u.toLowerCase());
  const [m, e] = Math.abs(v).toExponential(1).split('e+');
  return `${v < 0 ? '-' : ''}$${m!.replace(/\.0$/, '')}e${e}`;
}

export const listFormat = new Intl.ListFormat('en-US', { type: 'conjunction' });

export function displayName(p: Pick<PlanInput, 'name'>, index: number): string {
  return p.name.trim() || `Plan ${index + 1}`;
}
