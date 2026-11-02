'use client';

import { usePlotArea, useXAxisScale, useYAxisScale } from 'recharts';
import { COPY } from '@/copy';
import { annualCost } from '@/engine/cost';
import type { PayFrequency, Plan } from '@/engine/types';
import { formatUsd } from '@/format';
import { RoostFlock } from './Murmuration';

// Text over the plot gets a paper-coloured outline, so lines passing behind it don't cut through.
const halo = { stroke: 'var(--color-paper)', strokeWidth: 4, strokeLinejoin: 'round' as const, paintOrder: 'stroke' };
const axisTitle = { fontSize: 13, fontWeight: 600, fill: 'var(--color-ink-2)' };

/** Drawn last inside the chart: axis titles, crossover labels, the expected-care-cost pill and the roost. */
export function ChartOverlays({
  plans,
  payFrequency,
  markers,
  extent,
  expectedCareCost,
  belowZero,
  signature,
}: {
  plans: Plan[];
  payFrequency: PayFrequency;
  markers: { careCost: number; annualCost: number }[];
  extent: number;
  expectedCareCost: number | null;
  belowZero: boolean;
  signature: string;
}) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const plot = usePlotArea();
  if (!xScale || !yScale || !plot || plot.width <= 0) return null;
  const X = (v: number) => xScale(v) ?? 0;
  const Y = (v: number) => yScale(v) ?? 0;
  const highest = (careCost: number) => Math.max(...plans.map((p) => annualCost(p, payFrequency, careCost)));
  const lowest = (careCost: number) => Math.min(...plans.map((p) => annualCost(p, payFrequency, careCost)));

  // Birds stand on the cheapest line: feet just above its 2.5px stroke.
  const perchAt = (t: number) => ({ x: X(extent * t), y: Y(lowest(extent * t)) - 1.5 });

  // A crossover label sits above every line across its own width. Lines only rise to the right,
  // so the highest point under the label is at its right edge.
  const labelHalfWidth = 26;
  const crossoverLabels =
    markers.length <= 3 && plot.width >= 420
      ? markers.map((m) => {
          const right = Math.min(extent, m.careCost + (labelHalfWidth * extent) / plot.width);
          return { key: m.careCost, x: X(m.careCost), y: Math.max(plot.y + 12, Y(highest(right)) - 8), text: formatUsd(m.careCost) };
        })
      : [];

  const pillText = expectedCareCost === null ? '' : `Expected ${formatUsd(expectedCareCost)}`;
  const pillW = pillText.length * 6.4 + 14;
  // Keep the pill clear of the "Annual Cost" title at the top left.
  const pillX = expectedCareCost === null ? 0 : Math.min(Math.max(X(expectedCareCost) - pillW / 2, 96), plot.x + plot.width - pillW);

  return (
    <g aria-hidden="true" pointerEvents="none" className="num">
      <text x={4} y={plot.y - 12} {...axisTitle}>
        Annual Cost
      </text>
      <text x={plot.x + plot.width} y={plot.y + plot.height + 44} textAnchor="end" {...axisTitle}>
        Care Cost
      </text>
      {belowZero && (
        // Bottom right: by then every line has climbed toward its worst case, well clear of this corner.
        <text x={plot.x + plot.width - 6} y={plot.y + plot.height - 8} textAnchor="end" fontSize={12} fill="var(--color-success)" {...halo} stroke="var(--color-success-wash)">
          {COPY.belowZero}
        </text>
      )}
      {crossoverLabels.map((l) => (
        <text key={l.key} x={l.x} y={l.y} textAnchor="middle" fontSize={12} fill="var(--color-muted)" {...halo}>
          {l.text}
        </text>
      ))}
      {expectedCareCost !== null && (
        <g transform={`translate(${pillX}, ${plot.y - 24})`}>
          <rect width={pillW} height={20} rx={6} fill="var(--color-paper)" stroke="var(--color-hairline)" />
          <text x={pillW / 2} y={14} textAnchor="middle" fontSize={12} fill="var(--color-ink-2)">
            {pillText}
          </text>
        </g>
      )}
      <RoostFlock perchAt={perchAt} signature={signature} plot={plot} />
    </g>
  );
}
