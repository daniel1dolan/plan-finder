'use client';

import { useState } from 'react';
import { COPY } from '@/copy';
import { FIELD_MAX, MAX_EXPECTED_CARE_COST } from '@/engine/types';
import { parseAmount } from '@/engine/validate';
import { formatUsd } from '@/format';
import { AlertIcon } from './icons';
import { Term } from './Term';

const toRaw = (v: number | null) => (v === null ? '' : String(v));

export function CareCostSlider({ value, max, onChange }: { value: number | null; max: number; onChange: (v: number | null) => void }) {
  // The text box keeps what was typed; it only resyncs when the value changes from elsewhere.
  const [raw, setRaw] = useState(toRaw(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    const typed = parseAmount(raw);
    if (typed !== value && !(typed === null && value === null)) setRaw(toRaw(value));
  }
  // Never clamped: an amount out of range shows an error and isn't committed.
  const commits = (n: ReturnType<typeof parseAmount>): n is number | null =>
    n === null || (typeof n === 'number' && n >= 0 && n <= MAX_EXPECTED_CARE_COST);
  const parsed = parseAmount(raw);
  const error = commits(parsed) ? null : typeof parsed === 'number' && parsed > MAX_EXPECTED_CARE_COST ? COPY.sliderTooBig : COPY.sliderError;
  const pct = value === null || max <= 0 ? 0 : Math.min(100, (value / max) * 100);

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Term term="expectedCareCost" className="text-[14px] leading-5 font-semibold text-ink-2" />
        <div className="w-[150px]">
          <div className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              maxLength={FIELD_MAX}
              aria-label="Expected Care Cost amount"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'care-cost-error' : undefined}
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                const n = parseAmount(e.target.value);
                if (commits(n)) {
                  setSeen(n);
                  onChange(n);
                }
              }}
              className="control has-prefix"
            />
          </div>
        </div>
      </div>
      {error && (
        <p id="care-cost-error" className="mt-1 flex items-center justify-end gap-1.5 text-[13.5px] text-error">
          <AlertIcon />
          {error}
        </p>
      )}
      <div className="slider-track mt-1">
        <input
          type="range"
          min={0}
          max={max}
          step={50}
          aria-label="Expected Care Cost"
          aria-valuetext={value === null ? 'Not set' : formatUsd(value)}
          data-unset={value === null}
          value={Math.min(value ?? 0, max)}
          onChange={(e) => {
            const v = Number(e.target.value);
            setRaw(String(v));
            setSeen(v);
            onChange(v);
          }}
          className="care-range"
          style={{ '--pct': `${pct}%` } as React.CSSProperties}
        />
      </div>
      {value === null && <p className="mt-1 text-[13.5px] leading-5 text-muted">{COPY.sliderNotSet}</p>}
    </div>
  );
}
