import { annualCost, breakpoints, spendFlatFrom } from './cost';
import type { ChartPoint, CheapestRange, PayFrequency, Plan } from './types';

const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

export function roundUpNice(value: number): number {
  if (value <= 0) return 0;
  const scale = 10 ** Math.floor(Math.log10(value));
  // 10 is in the list, so a log10 that lands just under an integer still finds the right step.
  return NICE.map((m) => m * scale).find((x) => x >= value)!;
}

export function chartExtent(plans: Plan[], expectedCareCost: number | null): number {
  return roundUpNice(Math.max(1000, 1.1 * Math.max(0, ...plans.map(spendFlatFrom)), expectedCareCost ?? 0));
}

/** Samples at every breakpoint, so straight segments between them draw the lines exactly. */
export function chartSamples(plans: Plan[], payFrequency: PayFrequency, extent: number): ChartPoint[] {
  const xs = [...new Set([0, extent, ...plans.flatMap(breakpoints).filter((x) => x <= extent)])].sort((a, b) => a - b);
  return xs.map((careCost) => ({
    careCost,
    costs: Object.fromEntries(plans.map((p) => [p.id, annualCost(p, payFrequency, careCost)])),
  }));
}

export function crossoverMarkers(
  ranges: CheapestRange[],
  plans: Plan[],
  payFrequency: PayFrequency,
): { careCost: number; annualCost: number }[] {
  return ranges.slice(1).map((r) => ({
    careCost: r.from,
    annualCost: annualCost(plans.find((p) => p.id === r.planIds[0])!, payFrequency, r.from),
  }));
}
