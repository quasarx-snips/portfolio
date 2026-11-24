import { useSyncExternalStore } from 'react';
import type { BootSnapshot, PageId, PageProgress, PageSpec } from './types';

/**
 * The boot store is deliberately tiny: a single immutable snapshot plus a
 * listener set, read by React through useSyncExternalStore. The scheduler owns
 * writes; everything else only reads.
 */

const EMPTY_PAGES: PageProgress[] = [];

export const EMPTY_BOOT: BootSnapshot = {
  phase: 'idle',
  progress: 0,
  pages: EMPTY_PAGES,
  activePage: null,
  label: '',
  detail: '',
  elapsedMs: 0,
  slow: false,
  degraded: false,
};

let snapshot: BootSnapshot = EMPTY_BOOT;
const listeners = new Set<() => void>();

function emit(next: BootSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function toPage(spec: PageSpec): PageProgress {
  return {
    id: spec.id,
    label: spec.label,
    detail: spec.detail,
    status: 'queued',
    progress: 0,
    startedAt: null,
    finishedAt: null,
    failed: false,
  };
}

export function getBootSnapshot(): BootSnapshot {
  return snapshot;
}

export function subscribeBoot(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React binding for the boot snapshot. */
export function useBootSnapshot(): BootSnapshot {
  return useSyncExternalStore(subscribeBoot, getBootSnapshot, getBootSnapshot);
}

/** Start a fresh run. Called once, before the first task is scheduled. */
export function beginBoot(pages: PageSpec[]): void {
  emit({
    ...EMPTY_BOOT,
    phase: 'loading',
    pages: pages.map(toPage),
  });
}

/** Replace a single page's fields, keeping every other page object stable. */
export function patchPage(id: PageId, patch: Partial<PageProgress>): void {
  const index = snapshot.pages.findIndex((page) => page.id === id);
  if (index < 0) return;
  const pages = snapshot.pages.slice();
  pages[index] = { ...pages[index], ...patch };
  emit({ ...snapshot, pages });
}

/** Patch top-level snapshot fields (progress, active page, status copy…). */
export function patchBoot(patch: Partial<BootSnapshot>): void {
  emit({ ...snapshot, ...patch });
}

/**
 * Advance overall progress monotonically: a late page finishing can never make
 * the bar jump backwards.
 */
export function setBootProgress(progress: number): void {
  const next = Math.min(0.995, Math.max(snapshot.progress, progress));
  if (next - snapshot.progress < 0.0005) return;
  emit({ ...snapshot, progress: next });
}

/** Reset between runs (hot reload, QA). */
export function resetBoot(): void {
  emit(EMPTY_BOOT);
}
