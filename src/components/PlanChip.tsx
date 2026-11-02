import { dashFor } from '@/planStyle';

/** The plan's line sample: used on cards, in the legend, the table and end labels. */
export function PlanChip({ color, muted = false }: { color: string; muted?: boolean }) {
  return (
    <svg width={28} height={12} viewBox="0 0 28 12" aria-hidden="true" focusable="false" className="shrink-0" style={{ opacity: muted ? 0.35 : 1 }}>
      <line x1={2} y1={6} x2={21} y2={6} stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={dashFor(color)} />
      <circle cx={24} cy={6} r={3} fill={muted ? 'var(--color-paper)' : color} stroke={muted ? color : 'var(--color-paper)'} strokeWidth={1.5} />
    </svg>
  );
}
