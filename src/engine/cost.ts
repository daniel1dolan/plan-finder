import { FREQUENCIES, type CostBreakdown, type PayFrequency, type Plan } from './types';

export function annualPremium(premium: number, payFrequency: PayFrequency): number {
  return premium * FREQUENCIES[payFrequency].perYear;
}

export function outOfPocketSpend(plan: Plan, careCost: number): number {
  const { deductible, coinsurance, oopMax } = plan;
  return Math.min(oopMax, Math.min(careCost, deductible) + coinsurance * Math.max(0, careCost - deductible));
}

/** The care cost from which out-of-pocket spend stops growing. */
export function spendFlatFrom(plan: Plan): number {
  const { deductible, coinsurance, oopMax } = plan;
  return coinsurance > 0 ? deductible + (oopMax - deductible) / coinsurance : deductible;
}

export function contributionOffset(plan: Plan, outOfPocketSpend: number): number {
  const c = plan.employerContribution;
  if (!c) return 0;
  return c.type === 'hsa' ? c.amount : Math.min(c.amount, outOfPocketSpend);
}

export function annualCost(plan: Plan, payFrequency: PayFrequency, careCost: number): number {
  const spend = outOfPocketSpend(plan, careCost);
  return annualPremium(plan.premium, payFrequency) + spend - contributionOffset(plan, spend);
}

export function worstCaseCost(plan: Plan, payFrequency: PayFrequency): number {
  return annualCost(plan, payFrequency, spendFlatFrom(plan));
}

/** Care costs where the line kinks: sorted, unique, > 0. */
export function breakpoints(plan: Plan): number[] {
  const points = [plan.deductible, spendFlatFrom(plan)];
  const c = plan.employerContribution;
  // An HRA stops offsetting once spend passes its amount, which kinks the line there. With 0%
  // coinsurance, spend stops at the deductible and never reaches the OOP max.
  const maxSpend = plan.coinsurance > 0 ? plan.oopMax : plan.deductible;
  if (c?.type === 'hra' && c.amount > 0 && c.amount < maxSpend) {
    points.push(c.amount <= plan.deductible ? c.amount : plan.deductible + (c.amount - plan.deductible) / plan.coinsurance);
  }
  return [...new Set(points.filter((x) => x > 0))].sort((a, b) => a - b);
}

export function costBreakdown(plan: Plan, payFrequency: PayFrequency, careCost: number): CostBreakdown {
  const spend = outOfPocketSpend(plan, careCost);
  const offset = contributionOffset(plan, spend);
  const premium = annualPremium(plan.premium, payFrequency);
  return {
    annualPremium: premium,
    outOfPocketSpend: spend,
    contributionOffset: offset,
    annualCost: premium + spend - offset,
    worstCaseCost: worstCaseCost(plan, payFrequency),
  };
}
