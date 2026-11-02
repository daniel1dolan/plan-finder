import { MAX_PLANS, type Comparison, type PlanInput } from './engine/types';

let counter = 0;
export function newPlanId(): string {
  return `p${++counter}`;
}

/** First unused of "Plan A".."Plan F"; with at most MAX_PLANS plans, one is always free. */
export function nextPlanName(plans: PlanInput[]): string {
  const used = new Set(plans.map((p) => p.name.trim()));
  return `Plan ${'ABCDEF'.split('').find((l) => !used.has(`Plan ${l}`))}`;
}

export function newPlanInput(name: string): PlanInput {
  return { id: newPlanId(), name, premium: '', deductible: '', coinsurance: '20', oopMax: '', contributionType: null, contribution: '' };
}

export function blankComparison(): Comparison {
  return { plans: [newPlanInput('Plan A')], payFrequency: 'monthly', expectedCareCost: null };
}

export function exampleComparison(): Comparison {
  const plan = (name: string, premium: string, deductible: string, oopMax: string): PlanInput => ({
    ...newPlanInput(name),
    premium,
    deductible,
    oopMax,
  });
  return {
    plans: [plan('Low deductible', '200', '2000', '4000'), plan('High deductible', '100', '7000', '10000')],
    payFrequency: 'monthly',
    expectedCareCost: 5000,
  };
}

export function addPlan(c: Comparison): Comparison {
  if (c.plans.length >= MAX_PLANS) return c;
  return { ...c, plans: [...c.plans, newPlanInput(nextPlanName(c.plans))] };
}

export function removePlan(c: Comparison, id: string): Comparison {
  if (c.plans.length <= 1) return c;
  return { ...c, plans: c.plans.filter((p) => p.id !== id) };
}

export function updatePlan(c: Comparison, plan: PlanInput): Comparison {
  return { ...c, plans: c.plans.map((p) => (p.id === plan.id ? plan : p)) };
}
