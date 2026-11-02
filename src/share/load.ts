import { exampleComparison } from '../comparison';
import type { Comparison } from '../engine/types';
import { decodeComparison, payloadFromHash } from './codec';
import { loadAutoSave, type ReadStore } from './storage';

export type ComparisonSource = 'share' | 'autosave' | 'example';
export interface LoadedComparison {
  comparison: Comparison;
  source: ComparisonSource;
  shareLinkFailed: boolean;
}

/** Share link, else auto-save, else the example. Never writes, so a share link can't clobber the auto-save. */
export function loadInitialComparison(hash: string, store: ReadStore): LoadedComparison {
  const payload = payloadFromHash(hash);
  const shared = payload === null ? null : decodeComparison(payload);
  if (shared) return { comparison: shared, source: 'share', shareLinkFailed: false };
  const shareLinkFailed = payload !== null;
  const saved = loadAutoSave(store);
  if (saved) return { comparison: saved, source: 'autosave', shareLinkFailed };
  return { comparison: exampleComparison(), source: 'example', shareLinkFailed };
}
