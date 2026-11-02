'use client';

import { useEffect, useRef, useState } from 'react';
import { addPlan, blankComparison, removePlan, updatePlan } from '@/comparison';
import { COPY, type ShareFallback } from '@/copy';
import { cheapestRanges } from '@/engine/envelope';
import { MAX_PLANS, type Comparison, type Plan } from '@/engine/types';
import { validatePlan } from '@/engine/validate';
import { displayName } from '@/format';
import { PLAN_COLORS } from '@/planStyle';
import { decodeComparison, payloadFromHash } from '@/share/codec';
import { loadInitialComparison, type ComparisonSource } from '@/share/load';
import { saveAutoSave } from '@/share/storage';
import { notChartedSentence } from '@/summary';
import { ExampleBanner, ShareFailedNotice } from './ExampleBanner';
import { PlusIcon } from './icons';
import { PayFrequencySelect } from './PayFrequencySelect';
import { PlanCard } from './PlanCard';
import { Results } from './Results';
import { ShareButton } from './ShareButton';

const GRID = 'grid grid-cols-1 gap-8 mx-auto max-w-[720px] lg:max-w-none lg:grid-cols-[330px_1fr] xl:grid-cols-[380px_1fr] xl:gap-10';

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function PlanFinder() {
  const [origin, setOrigin] = useState<{ source: ComparisonSource; shareFailed: ShareFallback | null } | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [edited, setEdited] = useState(false);
  const nameInputs = useRef(new Map<string, HTMLInputElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const focusAfterRender = useRef<string | 'add' | null>(null);

  // Load after mount: the prerendered HTML is the placeholder, so hydration always matches.
  useEffect(() => {
    const l = loadInitialComparison(location.hash, storage() ?? { getItem: () => null });
    /* eslint-disable react-hooks/set-state-in-effect -- reading browser-only state has to happen after mount */
    setOrigin({ source: l.source, shareFailed: l.shareLinkFailed ? (l.source === 'autosave' ? 'autosave' : 'example') : null });
    setComparison(l.comparison);
    // Drop a bad fragment so a reload doesn't show the notice again.
    if (l.shareLinkFailed) history.replaceState(null, '', location.pathname + location.search);
    /* eslint-enable react-hooks/set-state-in-effect */

    const onHashChange = () => {
      const payload = payloadFromHash(location.hash);
      if (payload === null) return;
      const shared = decodeComparison(payload);
      if (shared) {
        setOrigin({ source: 'share', shareFailed: null });
        setComparison(shared);
        setEdited(false);
      } else {
        // Keep what's on screen, say so, and drop the bad fragment so a reload doesn't retry it.
        setOrigin((o) => o && { ...o, shareFailed: 'kept' });
        history.replaceState(null, '', location.pathname + location.search);
      }
    };
    addEventListener('hashchange', onHashChange);
    return () => removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const store = storage();
    if (edited && comparison && store) saveAutoSave(store, comparison);
  }, [comparison, edited]);

  useEffect(() => {
    const target = focusAfterRender.current;
    focusAfterRender.current = null;
    if (target === 'add') addButton.current?.focus();
    else if (target) nameInputs.current.get(target)?.focus();
  });

  if (!origin || !comparison) return <Placeholder />;

  // Every user action goes through here. The first edit drops the share fragment, so a reload
  // shows the user's edits instead of the original link, and starts the auto-save.
  const update = (next: Comparison) => {
    setComparison(next);
    if (origin.shareFailed) setOrigin({ ...origin, shareFailed: null });
    if (!edited) {
      setEdited(true);
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    }
  };
  const showExample = origin.source === 'example' && !edited;

  const { plans, payFrequency, expectedCareCost } = comparison;
  const statuses = plans.map((p, i) => validatePlan(p, displayName(p, i)));
  const valid: Plan[] = [];
  const colors: string[] = [];
  const notCharted: { name: string; status: 'incomplete' | 'invalid' }[] = [];
  statuses.forEach((s, i) => {
    if (s.status === 'valid') {
      valid.push(s.plan);
      colors.push(PLAN_COLORS[i]!);
    } else notCharted.push({ name: displayName(plans[i]!, i), status: s.status });
  });
  const ranges = cheapestRanges(valid, payFrequency);
  const atMax = plans.length >= MAX_PLANS;

  return (
    <div className={GRID}>
      {(origin.shareFailed || showExample) && (
        <div className="flex flex-col gap-3 lg:col-span-2">
          {origin.shareFailed && <ShareFailedNotice fallback={origin.shareFailed} />}
          {showExample && (
            <ExampleBanner
              onStartFresh={() => {
                const blank = blankComparison();
                focusAfterRender.current = blank.plans[0]!.id;
                update(blank);
              }}
            />
          )}
        </div>
      )}

      <section aria-labelledby="your-plans" className="flex min-w-0 flex-col gap-4">
        <h2 id="your-plans" className="font-serif text-[20px] leading-[26px] font-medium sm:text-[22px] sm:leading-7">
          {COPY.yourPlans}
        </h2>
        <PayFrequencySelect value={payFrequency} onChange={(pf) => update({ ...comparison, payFrequency: pf })} />
        {plans.map((p, i) => (
          <PlanCard
            key={p.id}
            plan={p}
            index={i}
            status={statuses[i]!}
            payFrequency={payFrequency}
            canRemove={plans.length > 1}
            color={PLAN_COLORS[i]!}
            nameInputRef={(el) => {
              if (el) nameInputs.current.set(p.id, el);
              else nameInputs.current.delete(p.id);
            }}
            onChange={(next) => update(updatePlan(comparison, next))}
            onRemove={() => {
              focusAfterRender.current = 'add';
              update(removePlan(comparison, p.id));
            }}
          />
        ))}
        <div className="flex flex-col gap-2">
          <button
            ref={addButton}
            type="button"
            disabled={atMax}
            aria-describedby={atMax ? 'max-plans-hint' : undefined}
            onClick={() => {
              const next = addPlan(comparison);
              focusAfterRender.current = next.plans.at(-1)!.id;
              update(next);
            }}
            className="btn h-14 w-full rounded-lg border-[1.5px] border-dashed border-axis text-ink-2 hover:border-edge hover:bg-paper disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-axis disabled:hover:bg-transparent"
          >
            <PlusIcon />
            Add plan
          </button>
          {atMax && (
            <p id="max-plans-hint" className="text-[13.5px] text-muted">
              {COPY.maxPlansHint}
            </p>
          )}
        </div>
      </section>

      <div className="flex min-w-0 flex-col gap-6">
        <Results
          valid={valid}
          colors={colors}
          payFrequency={payFrequency}
          ranges={ranges}
          expectedCareCost={expectedCareCost}
          notCharted={notChartedSentence(notCharted)}
          onExpectedCareCostChange={(v) => update({ ...comparison, expectedCareCost: v })}
        />
        <ShareButton comparison={comparison} />
      </div>
    </div>
  );
}

function Placeholder() {
  return (
    <div className={GRID} aria-hidden="true">
      <div className="h-[78px] rounded-lg bg-sunk/60 lg:col-span-2" />
      <div className="flex flex-col gap-4">
        <div className="h-[88px] rounded-lg bg-sunk/60" />
        <div className="h-[380px] rounded-lg bg-sunk/60" />
        <div className="h-[380px] rounded-lg bg-sunk/60" />
      </div>
      <div className="h-[560px] rounded-xl bg-sunk/60" />
    </div>
  );
}
