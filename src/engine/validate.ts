import type { FieldError, PlanField, PlanInput, PlanStatus } from './types';

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

/** null = blank, 'nan' = not a plain decimal. Formatting is stripped; values are never clamped. */
export function parseAmount(raw: string, opts?: { percent?: boolean }): number | null | 'nan' {
  let s = raw.replace(/[\s,$]/g, '');
  if (opts?.percent) s = s.replace(/%$/, '');
  if (s === '') return null;
  if (!NUMBER.test(s)) return 'nan';
  const n = Number(s);
  return Number.isFinite(n) ? n : 'nan';
}

export const FIELD_LABELS: Record<PlanField, string> = {
  premium: 'Premium',
  deductible: 'Deductible',
  coinsurance: 'Coinsurance',
  oopMax: 'OOP Max',
  contribution: 'Employer Contribution',
};

export function validatePlan(input: PlanInput, displayName: string): PlanStatus {
  const missing: PlanField[] = [];
  const errors: FieldError[] = [];
  const values: Partial<Record<PlanField, number>> = {};

  const fields: PlanField[] = ['premium', 'deductible', 'coinsurance', 'oopMax'];
  if (input.contributionType !== null) fields.push('contribution');

  for (const field of fields) {
    const n = parseAmount(input[field], { percent: field === 'coinsurance' });
    if (n === null) missing.push(field);
    else if (n === 'nan') errors.push({ field, message: `${FIELD_LABELS[field]} must be a number` });
    else if (field === 'coinsurance' && (n < 0 || n > 100))
      errors.push({ field, message: 'Coinsurance must be between 0% and 100%' });
    else if (n < 0) errors.push({ field, message: `${FIELD_LABELS[field]} can't be negative` });
    else values[field] = n;
  }

  const { premium, deductible, coinsurance, oopMax, contribution } = values;
  if (deductible !== undefined && oopMax !== undefined && oopMax < deductible)
    errors.push({ field: 'oopMax', message: "OOP Max can't be less than the deductible" });

  if (errors.length) return { status: 'invalid', errors };
  if (missing.length) return { status: 'incomplete', missing };
  return {
    status: 'valid',
    plan: {
      id: input.id,
      name: displayName,
      premium: premium!,
      deductible: deductible!,
      coinsurance: coinsurance! / 100,
      oopMax: oopMax!,
      employerContribution:
        input.contributionType === null ? null : { type: input.contributionType, amount: contribution! },
    },
  };
}
