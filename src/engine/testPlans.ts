import type { ContributionType, Plan } from './types';

/** Test helper: plan(id, premium, deductible, coinsurance %, oopMax, contribution?). */
export function plan(
  id: string,
  premium: number,
  deductible: number,
  coinsurancePct: number,
  oopMax: number,
  contribution?: [ContributionType, number],
): Plan {
  return {
    id,
    name: id,
    premium,
    deductible,
    coinsurance: coinsurancePct / 100,
    oopMax,
    employerContribution: contribution ? { type: contribution[0], amount: contribution[1] } : null,
  };
}

export const A = plan('A', 200, 2000, 20, 4000);
export const B = plan('B', 100, 7000, 20, 10000);
