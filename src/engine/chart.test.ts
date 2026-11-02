import { describe, expect, test } from 'bun:test';
import { chartExtent, chartSamples, crossoverMarkers, roundUpNice } from './chart';
import { cheapestRanges } from './envelope';
import { A, B, plan } from './testPlans';

const six = [
  plan('F1', 0, 0, 100, 5000),
  plan('F2', 200, 0, 80, 5000),
  plan('F3', 600, 0, 60, 5000),
  plan('F4', 1200, 0, 40, 5000),
  plan('F5', 2000, 0, 20, 5000),
  plan('F6', 3000, 0, 0, 0),
];

describe('chart', () => {
  test('G1 roundUpNice', () => {
    expect([24200, 27500, 1000, 1001, 0].map(roundUpNice)).toEqual([25000, 30000, 1000, 1500, 0]);
  });
  test('G2 example extent', () => expect(chartExtent([A, B], 5000)).toBe(25000));
  test('G3 six-plan extent', () => expect(chartExtent(six, null)).toBe(30000));
  test('G4 floor of $1,000', () => expect(chartExtent([plan('K', 3000, 0, 0, 0)], null)).toBe(1000));
  test('G5 expected care cost widens the extent', () => expect(chartExtent([A, B], 40000)).toBe(40000));
  test('G6 samples at every breakpoint', () => {
    const s = chartSamples([A, B], 'monthly', 25000);
    expect(s.map((p) => p.careCost)).toEqual([0, 2000, 7000, 12000, 22000, 25000]);
    const at22k = s.find((p) => p.careCost === 22000)!;
    expect(at22k.costs.A).toBeCloseTo(6400, 6);
    expect(at22k.costs.B).toBeCloseTo(11200, 6);
  });
  test('G7 breakpoints beyond the extent are dropped; 0 and extent kept', () => {
    expect(chartSamples([A, B], 'monthly', 10000).map((p) => p.careCost)).toEqual([0, 2000, 7000, 10000]);
    expect(chartSamples([plan('K', 3000, 0, 0, 0)], 'annual', 1000).map((p) => p.careCost)).toEqual([0, 1000]);
  });
  test('G8 crossover markers', () => {
    expect(crossoverMarkers(cheapestRanges([A, B], 'monthly'), [A, B], 'monthly')).toEqual([
      { careCost: 3500, annualCost: 4700 },
    ]);
  });
});
