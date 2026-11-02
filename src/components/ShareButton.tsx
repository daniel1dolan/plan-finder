'use client';

import { useEffect, useState } from 'react';
import { COPY } from '@/copy';
import type { Comparison } from '@/engine/types';
import { shareUrl } from '@/share/codec';
import { CheckIcon, LinkIcon } from './icons';

export function ShareButton({ comparison }: { comparison: Comparison }) {
  const [shown, setShown] = useState(false);
  const [status, setStatus] = useState<{ copied: boolean; n: number } | null>(null);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(t);
  }, [status]);

  const copy = async () => {
    const link = shareUrl(comparison, location);
    setShown(true);
    let copied = false;
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
    } catch {
      // Clipboard can be blocked (permissions, insecure context); the link is shown below instead.
    }
    setStatus((s) => ({ copied, n: (s?.n ?? 0) + 1 }));
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="relative inline-flex">
          <button type="button" onClick={copy} className="btn btn-primary w-full sm:w-auto">
            <LinkIcon />
            Copy share link
          </button>
          {status?.copied && (
            <span key={status.n} aria-hidden="true" className="copy-bird pointer-events-none absolute -top-1 right-1 text-bird">
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 6l4-3 4 3" />
              </svg>
            </span>
          )}
        </span>
        <p aria-live="polite" className="min-h-6 text-[14px]">
          {status && (
            <span key={status.n} className={`fade-in inline-flex items-center gap-1.5 ${status.copied ? 'text-success' : 'text-ink-2'}`}>
              {status.copied && <CheckIcon />}
              {status.copied ? 'Link copied' : 'Copy the link below'}
            </span>
          )}
        </p>
      </div>
      {shown && (
        <div className="mt-3">
          <input
            readOnly
            aria-label="Share link"
            value={shareUrl(comparison, location)} // always the current comparison, never a stale copy
            onFocus={(e) => e.currentTarget.select()}
            className="control bg-sunk font-mono text-[13.5px]"
          />
          <p className="mt-2 text-[13.5px] text-muted">{COPY.shareHelper}</p>
        </div>
      )}
    </div>
  );
}
