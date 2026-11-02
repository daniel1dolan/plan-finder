'use client';

import { useEffect, useId, useRef } from 'react';
import { TERMS, type TermKey } from '@/copy';
import { InfoIcon } from './icons';

/** Native popover: Esc, light dismiss and focus return come free. JS only positions it. */
export function InfoPopover({ term }: { term: TermKey }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { label, body } = TERMS[term];

  useEffect(() => {
    const pop = panel.current;
    const btn = button.current;
    if (!pop || !btn) return;
    // Placed on `toggle`, after the panel is shown, so its real size is measurable. It keeps 12px
    // from every edge and flips above the trigger when it doesn't fit below.
    const place = () => {
      const r = btn.getBoundingClientRect();
      const w = pop.offsetWidth;
      const h = pop.offsetHeight;
      const below = r.bottom + 8;
      const top = below + h <= innerHeight - 12 ? below : Math.max(12, r.top - 8 - h);
      pop.style.left = `${Math.max(12, Math.min(r.left - 12, innerWidth - w - 12))}px`;
      pop.style.top = `${top}px`;
    };
    const stopTracking = () => {
      removeEventListener('scroll', place, { capture: true });
      removeEventListener('resize', place);
    };
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState !== 'open') return stopTracking();
      place();
      addEventListener('scroll', place, { capture: true, passive: true });
      addEventListener('resize', place);
    };
    pop.addEventListener('toggle', onToggle);
    return () => {
      pop.removeEventListener('toggle', onToggle);
      stopTracking();
    };
  }, []);

  return (
    <>
      <button
        ref={button}
        type="button"
        popoverTarget={id}
        aria-label={`About ${label}`}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full align-middle text-muted transition-colors duration-[120ms] hover:text-sheen focus-visible:text-sheen"
      >
        <InfoIcon />
      </button>
      <div ref={panel} id={id} popover="auto" className="info-pop text-left font-normal tracking-normal whitespace-normal normal-case">
        <p className="mb-1 font-serif text-[17px] leading-6 font-semibold text-ink">{label}</p>
        <p>{body}</p>
      </div>
    </>
  );
}
