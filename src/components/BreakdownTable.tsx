import { COPY } from '@/copy';
import { TERMS, type TermKey } from '@/copy';
import { annualPremium, costBreakdown, worstCaseCost } from '@/engine/cost';
import { cheapestPlanIds } from '@/engine/envelope';
import type { PayFrequency, Plan } from '@/engine/types';
import { formatUsd } from '@/format';
import { PerchedBirdIcon } from './icons';
import { PlanChip } from './PlanChip';
import { InfoPopover } from './InfoPopover';

/**
 * Non-breaking hyphens keep "Out-of-Pocket" and "Worst-Case" whole, and the ⓘ stays glued to the last
 * word instead of taking its own column or line, so every header fits on two lines.
 */
function HeaderLabel({ term }: { term: TermKey }) {
  const words = TERMS[term].label.replace(/-/g, '\u2011').split(' ');
  const last = words.pop();
  return (
    <>
      {words.join(' ')}{' '}
      <span className="whitespace-nowrap">
        {last} <InfoPopover term={term} />
      </span>
    </>
  );
}

const COLUMNS: TermKey[] = ['annualPremium', 'outOfPocketSpend', 'contributionOffset', 'annualCost', 'worstCaseCost'];

export function BreakdownTable({
  plans,
  colors,
  payFrequency,
  expectedCareCost,
}: {
  plans: Plan[];
  colors: string[];
  payFrequency: PayFrequency;
  expectedCareCost: number | null;
}) {
  const cheapestIds = expectedCareCost === null ? [] : cheapestPlanIds(plans, payFrequency, expectedCareCost);
  return (
    <div tabIndex={0} role="region" aria-label="Cost breakdown" className="overflow-x-auto rounded-lg border border-hairline bg-paper">
      {/* Fits without scrolling from 1024px; narrower screens scroll inside this wrapper. */}
      <table data-testid="breakdown" className="num w-full min-w-[600px] border-collapse text-[15px] leading-[22px] lg:min-w-0">
        <caption className="text-left text-[13.5px] text-muted">
          {/* Sticky, so the caption stays in view when the table is scrolled sideways. */}
          <span className="sticky left-0 block w-fit px-4 pt-3 pb-2">
            {COPY.tableCaption(expectedCareCost === null ? null : formatUsd(expectedCareCost))}
          </span>
        </caption>
        <thead>
          <tr className="bg-sunk text-[12.5px] leading-[17px] font-semibold text-ink-2">
            <th scope="col" className="sticky left-0 bg-sunk py-2 pr-2 pl-4 text-left lg:static">
              Plan
            </th>
            {COLUMNS.map((t) => (
              <th key={t} scope="col" className="px-2 py-2 text-right last:pr-4">
                <HeaderLabel term={t} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plans.map((p, i) => {
            const cheapest = cheapestIds.includes(p.id);
            const b = expectedCareCost === null ? null : costBreakdown(p, payFrequency, expectedCareCost);
            const cell = 'px-2 text-right whitespace-nowrap';
            const bg = cheapest ? 'bg-cheapest-wash' : 'bg-paper';
            const dash = <span className="text-muted">—</span>;
            return (
              <tr key={p.id} data-cheapest={cheapest ? 'true' : undefined} className={`h-12 border-t border-grid ${bg}`}>
                <th scope="row" className={`sticky left-0 py-[3px] pr-2 pl-4 text-left font-normal text-ink lg:static ${bg}`}>
                  {/* Name on one line with the badge under it, so a cheapest row stays 48px tall. */}
                  <span className="flex items-center gap-2">
                    <PlanChip color={colors[i]!} />
                    <span className="flex min-w-0 flex-col items-start">
                      <span className="max-w-[9.5rem] truncate" title={p.name}>
                        {p.name}
                      </span>
                      {cheapest && (
                        <span className="inline-flex h-[18px] items-center gap-1 rounded-full bg-badge px-1.5 text-[11.5px] leading-none font-bold text-sheen">
                          <PerchedBirdIcon />
                          Cheapest
                        </span>
                      )}
                    </span>
                  </span>
                </th>
                {/* Annual premium doesn't depend on care cost, so it shows even with no expected care cost. */}
                <td className={cell}>{formatUsd(annualPremium(p.premium, payFrequency))}</td>
                <td className={cell}>{b ? formatUsd(b.outOfPocketSpend) : dash}</td>
                <td className={cell}>{b ? formatUsd(-b.contributionOffset) : dash}</td>
                <td className={`${cell} font-semibold`}>{b ? formatUsd(b.annualCost) : dash}</td>
                <td className={`${cell} pr-4 text-ink-2`}>{formatUsd(worstCaseCost(p, payFrequency))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
