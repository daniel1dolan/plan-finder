import { annualCost, worstCaseCost } from './engine/cost';
import { TIE_TOLERANCE, type CheapestRange, type PayFrequency, type Plan } from './engine/types';
import { formatUsd, listFormat } from './format';

export function cheapestRangeSentence(ranges: CheapestRange[], plans: Plan[], payFrequency: PayFrequency): string {
  if (plans.length === 0) return "Fill in a plan's premium, deductible and OOP max to see results.";
  if (plans.length === 1) {
    const p = plans[0]!;
    return `${p.name} is the only plan charted; its annual cost runs from ${formatUsd(annualCost(p, payFrequency, 0))} to ${formatUsd(worstCaseCost(p, payFrequency))}.`;
  }

  const byId = new Map(plans.map((p) => [p.id, p]));
  const parts = ranges.map((r, i) => {
    const tied = r.planIds.map((id) => byId.get(id)!);
    let subject: string;
    if (tied.length === 1) subject = `${tied[0]!.name} is cheapest`;
    else {
      subject = `${listFormat.format(tied.map((p) => p.name))} are tied for cheapest`;
      const end = r.to ?? r.from + 1;
      const flatCost = annualCost(tied[0]!, payFrequency, r.from);
      const flat = tied.every(
        (p) =>
          Math.abs(annualCost(p, payFrequency, r.from) - flatCost) <= TIE_TOLERANCE &&
          Math.abs(annualCost(p, payFrequency, end) - flatCost) <= TIE_TOLERANCE,
      );
      if (flat) subject += ` at ${formatUsd(flatCost)}`;
    }

    let span: string;
    if (ranges.length === 1) span = ' at every care cost';
    else if (i === 0) span = ` up to ${formatUsd(r.to!)} of care cost`;
    else if (r.to === null) span = ` from ${formatUsd(r.from)} on`;
    else span = ` from ${formatUsd(r.from)} to ${formatUsd(r.to)}`;
    return subject + span;
  });
  return `${parts.join('; ')}.`;
}

export function notChartedSentence(items: { name: string; status: 'incomplete' | 'invalid' }[]): string | null {
  if (items.length === 0) return null;
  return `Not charted: ${items.map((i) => `${i.name} (${i.status})`).join(', ')}.`;
}
