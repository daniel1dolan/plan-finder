'use client';

import { useId } from 'react';
import type { TermKey } from '@/copy';
import { COPY } from '@/copy';
import { FIELD_MAX, FREQUENCIES, NAME_MAX, type ContributionType, type PayFrequency, type PlanField, type PlanInput, type PlanStatus } from '@/engine/types';
import { FIELD_LABELS } from '@/engine/validate';
import { displayName, listFormat } from '@/format';
import { AlertIcon, CloseIcon, RingIcon } from './icons';
import { PlanChip } from './PlanChip';
import { Term } from './Term';

export function PlanCard({
  plan,
  index,
  status,
  payFrequency,
  canRemove,
  color,
  nameInputRef,
  onChange,
  onRemove,
}: {
  plan: PlanInput;
  index: number;
  status: PlanStatus;
  payFrequency: PayFrequency;
  canRemove: boolean;
  color: string;
  nameInputRef?: (el: HTMLInputElement | null) => void;
  onChange: (p: PlanInput) => void;
  onRemove: () => void;
}) {
  const uid = useId();
  const name = displayName(plan, index);
  const errors = status.status === 'invalid' ? status.errors : [];
  const errorFor = (f: PlanField) => errors.find((e) => e.field === f)?.message;

  const field = (key: PlanField, term: TermKey, label: string, affix: '$' | '%') => {
    const id = `${uid}-${key}`;
    const error = errorFor(key);
    return (
      <div className="min-w-0">
        <Term term={term} htmlFor={id} className="mb-1 text-[14px] leading-5 font-semibold text-ink-2">
          {label}
        </Term>
        <div className="relative">
          <span aria-hidden="true" className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[16px] text-muted ${affix === '$' ? 'left-3' : 'right-3'}`}>
            {affix}
          </span>
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            maxLength={FIELD_MAX}
            value={plan[key]}
            onChange={(e) => onChange({ ...plan, [key]: e.target.value })}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={`control ${affix === '$' ? 'has-prefix' : 'has-suffix'}`}
          />
        </div>
        {error && (
          <p id={`${id}-error`} className="mt-1 flex items-start gap-1.5 text-[13.5px] leading-5 text-error">
            <AlertIcon className="mt-[3px]" />
            {error}
          </p>
        )}
      </div>
    );
  };

  const typeId = `${uid}-type`;
  const contributionTerm: TermKey = plan.contributionType === 'hra' ? 'hraContribution' : 'hsaContribution';
  const contributionLabel = plan.contributionType === 'hra' ? 'HRA Contribution per year' : 'HSA Contribution per year';

  return (
    <fieldset
      data-status={status.status}
      className={`card-in @container min-w-0 rounded-lg border bg-paper p-4 shadow-card sm:p-5 ${status.status === 'invalid' ? 'border-error-line' : 'border-hairline'}`}
    >
      <legend className="sr-only">{name}</legend>
      <div className="mb-4 flex items-start gap-3">
        <div className="pt-[38px]">
          <PlanChip color={color} muted={status.status !== 'valid'} />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={`${uid}-name`} className="mb-1.5 block text-[12.5px] leading-4 text-muted">
            Plan name
          </label>
          <input
            id={`${uid}-name`}
            ref={nameInputRef}
            type="text"
            autoComplete="off"
            maxLength={NAME_MAX}
            placeholder={`Plan ${index + 1}`}
            value={plan.name}
            onChange={(e) => onChange({ ...plan, name: e.target.value })}
            className="name-input"
          />
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className="btn btn-ghost h-11 w-11 shrink-0 p-0 sm:h-9 sm:w-9">
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-[14px] @min-[280px]:grid-cols-2">
        {field('premium', 'premium', `Premium per ${FREQUENCIES[payFrequency].period}`, '$')}
        {field('deductible', 'deductible', 'Deductible', '$')}
        {field('coinsurance', 'coinsurance', 'Coinsurance', '%')}
        {field('oopMax', 'oopMax', 'OOP Max', '$')}
        <div className="min-w-0">
          <Term term="employerContribution" htmlFor={typeId} className="mb-1 text-[14px] leading-5 font-semibold text-ink-2" />
          <select
            id={typeId}
            value={plan.contributionType ?? ''}
            onChange={(e) => onChange({ ...plan, contributionType: (e.target.value || null) as ContributionType | null })}
            className="control"
          >
            <option value="">None</option>
            <option value="hsa">HSA</option>
            <option value="hra">HRA</option>
          </select>
        </div>
        {plan.contributionType === null ? (
          <div className="flex min-w-0 items-end">
            <p className="flex h-11 items-center text-[14px] text-muted">{COPY.noContribution}</p>
          </div>
        ) : (
          <div className="fade-in min-w-0">{field('contribution', contributionTerm, contributionLabel, '$')}</div>
        )}
      </div>

      {status.status !== 'valid' && (
        <p
          className={`mt-4 flex items-start gap-2 border-t border-hairline pt-3 text-[13.5px] leading-5 ${status.status === 'invalid' ? 'text-error' : 'text-ink-2'}`}
        >
          {status.status === 'invalid' ? <AlertIcon className="mt-[3px]" /> : <RingIcon className="mt-1" />}
          {status.status === 'invalid' ? 'Not charted: fix the highlighted fields.' : `Not charted yet: add ${listFormat.format(status.missing.map((f) => (f === 'contribution' ? contributionLabel : FIELD_LABELS[f])))}.`}
        </p>
      )}
    </fieldset>
  );
}
