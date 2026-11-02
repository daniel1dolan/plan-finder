'use client';

import { useEffect, useRef, useState } from 'react';
import { COPY } from '@/copy';
import { chartExtent, chartSamples, crossoverMarkers } from '@/engine/chart';
import type { CheapestRange, PayFrequency, Plan } from '@/engine/types';
import { cheapestRangeSentence } from '@/summary';
import { BreakdownTable } from './BreakdownTable';
import { CareCostSlider } from './CareCostSlider';
import { HowToRead } from './HowToRead';
import { RingIcon } from './icons';
import { ResultsChart } from './ResultsChart';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Results({
  valid,
  colors,
  payFrequency,
  ranges,
  expectedCareCost,
  notCharted,
  onExpectedCareCostChange,
}: {
  valid: Plan[];
  colors: string[];
  payFrequency: PayFrequency;
  ranges: CheapestRange[];
  expectedCareCost: number | null;
  notCharted: string | null;
  onExpectedCareCostChange: (v: number | null) => void;
}) {
  const sentence = cheapestRangeSentence(ranges, valid, payFrequency);
  // The slider's range comes from the plans alone, so dragging never moves its own max; a larger
  // typed amount only widens the chart.
  const sliderMax = chartExtent(valid, null);
  const extent = chartExtent(valid, expectedCareCost);
  const samples = chartSamples(valid, payFrequency, extent);
  const markers = crossoverMarkers(ranges, valid, payFrequency);
  const signature = ranges.map((r) => `${r.from}:${r.planIds}`).join('|');

  // Announce and wash only once typing pauses, and only when the answer itself changed.
  const announced = useDebounced(sentence, 700);
  const settledSignature = useDebounced(signature, 700);
  const prevSignature = useRef(settledSignature);
  const [wash, setWash] = useState(0);
  useEffect(() => {
    if (prevSignature.current === settledSignature) return;
    const first = prevSignature.current === '';
    prevSignature.current = settledSignature;
    if (!first && settledSignature) setWash((w) => w + 1);
  }, [settledSignature]);

  const card = (
    <div className="relative overflow-hidden rounded-xl bg-paper px-5 py-5 shadow-raised sm:px-8 sm:py-7">
      {wash > 0 && <div key={wash} aria-hidden="true" className="settle-wash-layer pointer-events-none absolute inset-0" />}
      <div className="relative">
        <h2 className="mb-2 text-[12.5px] leading-4 font-bold tracking-[0.08em] text-muted uppercase">{COPY.answerEyebrow}</h2>
        <p className="sr-only" aria-live="polite">
          {announced}
        </p>
        {valid.length === 0 ? (
          <p data-testid="cheapest-summary" className="font-serif text-[23px] leading-[30px] text-ink-2">
            {sentence}
          </p>
        ) : (
          <>
            <p
              data-testid="cheapest-summary"
              className={`font-serif text-[23px] leading-[30px] font-[450] text-pretty lining-nums proportional-nums ${sentence.length > 140 ? 'sm:text-[24px] sm:leading-8' : 'sm:text-[30px] sm:leading-[38px]'}`}
            >
              {sentence}
            </p>
            {notCharted && (
              <p data-testid="not-charted" className="mt-2 flex items-start gap-2 text-[14.5px] leading-5 text-muted">
                <RingIcon className="mt-1 shrink-0" />
                {notCharted}
              </p>
            )}
            <div className="mt-5">
              <ResultsChart
                plans={valid}
                payFrequency={payFrequency}
                samples={samples}
                extent={extent}
                markers={markers}
                expectedCareCost={expectedCareCost}
                colors={colors}
                label={sentence}
                signature={signature}
              />
            </div>
            <CareCostSlider value={expectedCareCost} max={sliderMax} onChange={onExpectedCareCostChange} />
          </>
        )}
      </div>
    </div>
  );

  if (valid.length === 0) return <div className="flex flex-col">{card}</div>;

  return (
    <div className="flex h-full flex-1 flex-col gap-6">
      <div className="live-track flex-1">
        <div className="live tall:sticky tall:top-4 tall:z-10">{card}</div>
      </div>
      <div className="detail flex flex-col gap-4">
        <BreakdownTable plans={valid} colors={colors} payFrequency={payFrequency} expectedCareCost={expectedCareCost} />
        <HowToRead />
      </div>
    </div>
  );
}
