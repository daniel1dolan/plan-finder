import type { Comparison } from '../engine/types';
import { decodeComparison, encodeComparison } from './codec';

export const AUTOSAVE_KEY = 'plan-finder:comparison';
export type ReadStore = Pick<Storage, 'getItem'>;
type WriteStore = Pick<Storage, 'setItem'>;

/** Reuses the share codec, so the auto-save is versioned and validated the same way. */
export function loadAutoSave(store: ReadStore): Comparison | null {
  try {
    const raw = store.getItem(AUTOSAVE_KEY);
    return raw === null ? null : decodeComparison(raw);
  } catch {
    return null;
  }
}

export function saveAutoSave(store: WriteStore, c: Comparison): void {
  try {
    store.setItem(AUTOSAVE_KEY, encodeComparison(c));
  } catch {
    // Private mode or a full quota: the comparison still works, it just won't survive a reload.
  }
}
