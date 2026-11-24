/**
 * Loading contracts.
 *
 * The experience is divided into "pages" — the prologue, the temple film, the
 * identity and the aftermath. Every network request, font face, code chunk or
 * one-off preparation step is a task attached to one of them, so the boot
 * screen can show honest per-page progress instead of a single indeterminate
 * bar. Nothing here touches the DOM; the scheduler and the UI both build on
 * these types.
 */

export type PageId = 'prologue' | 'film' | 'identity' | 'aftermath';

export type TaskKind = 'image' | 'module' | 'font' | 'work';

export type PageStatus = 'queued' | 'loading' | 'ready' | 'failed';

export interface PageSpec {
  id: PageId;
  /** Short name shown next to the bar. */
  label: string;
  /** One line of flavour shown while the page is in flight. */
  detail: string;
  /** Keep this page's bar on screen at least this long once it starts. */
  minDwellMs: number;
}

export interface BootTask {
  id: string;
  page: PageId;
  kind: TaskKind;
  /**
   * Relative cost used for the progress bar. Images can pass their transport
   * size in bytes; code chunks an estimate; fonts their typical subset size.
   */
  weight: number;
  /** A failed critical task keeps the gate closed (until the hard timeout). */
  critical: boolean;
  /**
   * Performs the work. `signal` aborts on timeout, cancellation, or when the
   * tab stays hidden long enough that the scheduler parks background work.
   */
  run: (signal: AbortSignal) => Promise<unknown>;
}

export interface BootOptions {
  pages: PageSpec[];
  tasks: BootTask[];
  /** Run this page's tasks ahead of the others (normally the prologue). */
  firstPage: PageId;
  /** Max tasks in flight at once; defaults to a value derived from the network. */
  concurrency?: number;
  /** Reveal the app as soon as every critical task is done, even if the rest is not. */
  revealOnCritical?: boolean;
  /** After this long, stop holding the gate for non-essential work. */
  softTimeoutMs?: number;
  /** Hard stop: the gate opens no matter what. */
  hardTimeoutMs?: number;
  /** Never open before this much time has passed, so the loader can be read. */
  minDurationMs?: number;
  /** Called exactly once, when the gate may be lifted. */
  onReady?: () => void;
}

export interface PageProgress {
  id: PageId;
  label: string;
  detail: string;
  status: PageStatus;
  /** 0..1, weighted by task cost. */
  progress: number;
  startedAt: number | null;
  finishedAt: number | null;
  failed: boolean;
}

export interface BootSnapshot {
  phase: 'idle' | 'loading' | 'ready';
  /** 0..1 weighted across every task. Held below 1 until the gate opens. */
  progress: number;
  pages: PageProgress[];
  activePage: PageId | null;
  /** Copy for the boot screen: the active page's label/detail. */
  label: string;
  detail: string;
  elapsedMs: number;
  /** True once the load is taking noticeably longer than expected. */
  slow: boolean;
  /** True when non-critical work failed or timed out; the app still runs. */
  degraded: boolean;
}
