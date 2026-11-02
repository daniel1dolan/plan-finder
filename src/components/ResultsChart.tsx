'use client';

import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { ChartPoint, PayFrequency, Plan } from '@/engine/types';
import { formatUsdCompact } from '@/format';
import { dashFor } from '@/planStyle';
import { ChartOverlays } from './ChartOverlays';
import { PlanChip } from './PlanChip';
import { useMedia } from './useMedia';

const tickStyle = { fontSize: 12.5, fill: 'var(--color-muted)' };

export function ResultsChart({
  plans,
  payFrequency,
  samples,
  extent,
  markers,
  expectedCareCost,
  colors,
  label,
  signature,
}: {
  plans: Plan[];
  payFrequency: PayFrequency;
  samples: ChartPoint[];
  extent: number;
  markers: { careCost: number; annualCost: number }[];
  expectedCareCost: number | null;
  colors: string[];
  label: string;
  signature: string;
}) {
  const wide = useMedia('(min-width: 640px)') ?? false;
  // Wide enough for the longest compact tick ("-$1.2e20"); the slider track is inset to match.
  const yAxisWidth = wide ? 68 : 62;
  const yMin = Math.min(0, ...samples.flatMap((s) => Object.values(s.costs)));

  return (
    <div data-testid="cost-chart" role="img" aria-label={label}>
      {/* Legend as plain HTML above the plot, so it never competes with the chart's top margin. */}
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-ink-2">
        {plans.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2">
            <PlanChip color={colors[i]!} />
            {p.name}
          </li>
        ))}
      </ul>
      <div className="relative h-[300px] sm:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={samples} margin={{ top: 28, right: 28, bottom: 24, left: 4 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke="var(--color-grid)" strokeWidth={1} />
            <XAxis
              type="number"
              dataKey="careCost"
              domain={[0, extent]}
              ticks={[0, 1, 2, 3, 4, 5].map((i) => (extent * i) / 5)}
              tickFormatter={formatUsdCompact}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-axis)' }}
              tick={tickStyle}
              interval="preserveStartEnd" // thins ticks only when long labels would collide
              minTickGap={8}
            />
            <YAxis
              domain={[(min: number) => Math.min(0, min), 'auto']}
              tickCount={5}
              axisLine={false}
              tickLine={false}
              width={yAxisWidth}
              tickFormatter={formatUsdCompact}
              tick={tickStyle}
            />
            {yMin < 0 && (
              <ReferenceArea
                // Axis ticks round the domain below yMin, so overshoot and clip: the wash then reaches the axis.
                y1={yMin * 100 - 1e6}
                y2={0}
                fill="var(--color-success-wash)"
                fillOpacity={0.6}
                ifOverflow="hidden"
              />
            )}
            {yMin < 0 && <ReferenceLine y={0} stroke="var(--color-edge)" strokeWidth={1} />}
            {plans.map((p, i) => (
              <Line
                key={p.id}
                type="linear"
                dataKey={(d: ChartPoint) => d.costs[p.id]}
                name={p.name}
                stroke={colors[i]}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={dashFor(colors[i]!)}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}
            {expectedCareCost !== null && <ReferenceLine x={expectedCareCost} stroke="var(--color-ink-2)" strokeWidth={1.5} strokeOpacity={0.7} />}
            {markers.map((m) => (
              <ReferenceDot key={m.careCost} x={m.careCost} y={m.annualCost} r={6} fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth={2} />
            ))}
            <ChartOverlays
              plans={plans}
              payFrequency={payFrequency}
              markers={markers}
              extent={extent}
              expectedCareCost={expectedCareCost}
              belowZero={yMin < 0}
              signature={signature}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
