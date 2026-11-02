// `code` is part of the v1 share-link payload: never change an existing one.
export const FREQUENCIES = {
  weekly: { perYear: 52, label: 'Weekly', period: 'week', code: 'w' },
  biweekly: { perYear: 26, label: 'Biweekly', period: 'two weeks', code: 'b' },
  'semi-monthly': { perYear: 24, label: 'Semi-monthly', period: 'half-month', code: 's' },
  monthly: { perYear: 12, label: 'Monthly', period: 'month', code: 'm' },
  annual: { perYear: 1, label: 'Annual', period: 'year', code: 'a' },
} as const;
export type PayFrequency = keyof typeof FREQUENCIES;
export const PAY_FREQUENCIES = Object.keys(FREQUENCIES) as PayFrequency[];

export type ContributionType = 'hsa' | 'hra';
export const MAX_PLANS = 6;
export const NAME_MAX = 60;
export const FIELD_MAX = 20;
/** Shared by the expected-care-cost input and the share codec, so anything typed can be encoded. */
export const MAX_EXPECTED_CARE_COST = 1e9;
export const TIE_TOLERANCE = 0.005; // half a cent

/** What the user typed. Strings verbatim. */
export interface PlanInput {
  id: string; // runtime only, never encoded
  name: string;
  premium: string; // per pay period
  deductible: string;
  coinsurance: string; // percent, e.g. "20"
  oopMax: string;
  contributionType: ContributionType | null;
  contribution: string; // yearly amount; ignored when contributionType is null
}

export interface Comparison {
  plans: PlanInput[]; // 1..MAX_PLANS
  payFrequency: PayFrequency;
  expectedCareCost: number | null; // null = not set
}

/** A complete, valid plan. */
export interface Plan {
  id: string;
  name: string; // display name (already resolved via displayName)
  premium: number; // per pay period
  deductible: number;
  coinsurance: number; // fraction 0..1
  oopMax: number;
  employerContribution: { type: ContributionType; amount: number } | null;
}

export type PlanField = 'premium' | 'deductible' | 'coinsurance' | 'oopMax' | 'contribution';
export interface FieldError {
  field: PlanField;
  message: string;
}
export type PlanStatus =
  | { status: 'valid'; plan: Plan }
  | { status: 'incomplete'; missing: PlanField[] }
  | { status: 'invalid'; errors: FieldError[] };

export interface CheapestRange {
  from: number;
  to: number | null; // [from, to); last has to = null
  planIds: string[];
}
export interface CostBreakdown {
  annualPremium: number;
  outOfPocketSpend: number;
  contributionOffset: number;
  annualCost: number;
  worstCaseCost: number;
}
export interface ChartPoint {
  careCost: number;
  costs: Record<string, number>; // keyed by plan id
}
