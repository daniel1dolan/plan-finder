'use client';

import { useId } from 'react';
import { COPY } from '@/copy';
import { FREQUENCIES, PAY_FREQUENCIES, type PayFrequency } from '@/engine/types';
import { Term } from './Term';

export function PayFrequencySelect({ value, onChange }: { value: PayFrequency; onChange: (v: PayFrequency) => void }) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Term term="payFrequency" htmlFor={id} className="text-[14px] leading-5 font-semibold text-ink-2" />
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as PayFrequency)} className="control w-full sm:w-60">
        {PAY_FREQUENCIES.map((f) => (
          <option key={f} value={f}>
            {FREQUENCIES[f].label} ({FREQUENCIES[f].perYear} a year)
          </option>
        ))}
      </select>
      <span className="text-[13.5px] text-muted">{COPY.payFrequencyHint}</span>
    </div>
  );
}
