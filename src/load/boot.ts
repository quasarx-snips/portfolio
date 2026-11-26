import {
  beginBoot,
  getBootSnapshot,
  patchBoot,
  patchPage,
  setBootProgress,
} from './bootStore';
import type {
  BootOptions,
  BootSnapshot,
  BootTask,
  PageId,
  PageSpec,
} from './types';

/**
 * The boot scheduler.
 *
 * Everything the first screen needs is discovered here, not by the components:
 * pages are loaded in order, tasks are prioritised (critical first, biggest
 * first), and the number in flight adapts to the connection. The gate opens on
 * facts — every task settled, or the soft/hard deadline — never on a timer
 * guess. Work that outlives the gate keeps running quietly so late pages are
 * warm by the time the visitor reaches them.
 */

export interface BootHandle {
  promise: Promise<BootSnapshot>;
  cancel(): void;
}

const TASK_TIMEOUT_MS: Record<BootTask['kind'], number> = {
  image: 12_000,
  module: 9_000,
  font: 10_000,
  work: 20_000,
};

const RETRYABLE: Record<BootTask['kind'], boolean> = {
  image: true,
  module: true,
  font: true,
  work: false,
};

const RETRY_BASE_MS = 280;
const TICK_MS = 400;
const SLOW_AFTER_MS = 4_500;

interface TaskState {
  task: BootTask;
  weight: number;
  settled: boolean;
  ok: boolean;
  attempt: number;
  controller: AbortController | null;
  timer: number | null;
  retryTimer: number | null;
}

interface PageState {
  spec: PageSpec;
  order: number;
  tasks: TaskState[];
  queue: TaskState[];
  totalWeight: number;
  settledWeight: number;
  startedAt: number | null;
  finalized: boolean;
  criticalFailed: boolean;
  minDwellTimer: number | null;
}

interface Run {
  options: Required<
    Pick<BootOptions, 'firstPage' | 'softTimeoutMs' | 'hardTimeoutMs' | 'minDurationMs'>
  > &
    BootOptions;
  pages: PageState[];
  concurrency: number;
  inFlight: Set<TaskState>;
  settledWeight: number;
  totalWeight: number;
  startedAt: number;
  hiddenAt: number | null;
  hiddenMs: number;
  ready: boolean;
  cancelled: boolean;
  degraded: boolean;
  slow: boolean;
  resolve: (snapshot: BootSnapshot) => void;
  onReady?: () => void;
  ticker: number | null;
  readyTimer: number | null;
  visibilityHandler: (() => void) | null;
}

let activeCancel: (() => void) | null = null;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function deriveConcurrency(): number {
  if (typeof navigator === 'undefined') return 4;
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
    hardwareConcurrency?: number;
  };
  const connection = nav.connection;
  if (connection?.saveData) return 1;
  switch (connection?.effectiveType) {
    case 'slow-2g':
      return 1;
    case '2g':
      return 2;
    case '3g':
      return 3;
    default:
      return Math.min(6, Math.max(2, (nav.hardwareConcurrency || 4) - 1));
  }
}

/** Sort: first page first, then the declared order. Critical and heavy tasks lead. */
function sortPages(pages: PageSpec[], firstPage: PageId): PageSpec[] {
  return pages.slice().sort((a, b) => {
    if (a.id === firstPage && b.id !== firstPage) return -1;
    if (b.id === firstPage && a.id !== firstPage) return 1;
    return 0;
  });
}

function buildPages(options: BootOptions): PageState[] {
  const specs = sortPages(options.pages, options.firstPage);
  return specs.map((spec, order) => {
    const tasks: TaskState[] = options.tasks
      .filter((task) => task.page === spec.id)
      .map((task) => ({
        task,
        weight: Math.max(1, Math.round(task.weight)),
        settled: false,
        ok: false,
        attempt: 0,
        controller: null,
        timer: null,
        retryTimer: null,
      }))
      .sort((a, b) => {
        if (a.task.critical !== b.task.critical) return a.task.critical ? -1 : 1;
        return b.weight - a.weight;
      });
    const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0);
    return {
      spec,
      order,
      tasks,
      queue: tasks.slice(),
      totalWeight: Math.max(1, totalWeight),
      settledWeight: 0,
      startedAt: null,
      finalized: false,
      criticalFailed: false,
      minDwellTimer: null,
    };
  });
}

function visibleElapsed(run: Run): number {
  const hidden = run.hiddenMs + (run.hiddenAt === null ? 0 : now() - run.hiddenAt);
  return now() - run.startedAt - hidden;
}

function pageProgress(page: PageState): number {
  if (page.finalized) return 1;
  let progress = page.settledWeight / page.totalWeight;
  // A page with an open minimum dwell must not read 100% before it can finish.
  if (
    page.startedAt !== null &&
    progress >= 1 &&
    now() < page.startedAt + (page.spec.minDwellMs || 0)
  ) {
    progress = 0.96;
  }
  return Math.min(1, Math.max(0, progress));
}

function activePageOf(run: Run): PageState | null {
  for (const page of run.pages) {
    if (!page.finalized && page.startedAt !== null) return page;
  }
  for (const page of run.pages) {
    if (!page.finalized) return page;
  }
  return null;
}

function publishCopy(run: Run): void {
  // The overlay is gone once the gate opens; never rewrite its copy after that.
  if (run.ready) return;
  const activePage = activePageOf(run);
  patchBoot({
    activePage: activePage ? activePage.spec.id : null,
    label: activePage ? activePage.spec.label : 'Ready',
    detail: activePage ? activePage.spec.detail : 'The palace is awake.',
  });
}

function updatePage(page: PageState): void {
  patchPage(page.spec.id, {
    status: page.finalized ? (page.criticalFailed ? 'failed' : 'ready') : page.startedAt !== null ? 'loading' : 'queued',
    progress: pageProgress(page),
    startedAt: page.startedAt,
    finishedAt: page.finalized ? now() : null,
    failed: page.criticalFailed,
  });
}

function settle(run: Run, state: TaskState, page: PageState, ok: boolean): void {
  if (state.settled || run.cancelled) return;
  state.settled = true;
  state.ok = ok;
  if (state.timer !== null) window.clearTimeout(state.timer);
  state.timer = null;
  state.controller = null;
  run.inFlight.delete(state);
  page.settledWeight += state.weight;
  run.settledWeight += state.weight;

  if (!ok) {
    if (state.task.critical) page.criticalFailed = true;
    else run.degraded = true;
  }

  updatePage(page);
  setBootProgress(run.settledWeight / Math.max(1, run.totalWeight));
  finishPageIfSettled(run, page);
  publishCopy(run);
  checkReady(run);
  pump(run);
}

function finishPageIfSettled(run: Run, page: PageState): void {
  if (page.finalized) return;
  const complete = page.tasks.every((task) => task.settled);
  if (!complete) return;
  const wait = page.startedAt === null ? 0 : page.startedAt + (page.spec.minDwellMs || 0) - now();
  if (wait > 0) {
    if (page.minDwellTimer === null) {
      page.minDwellTimer = window.setTimeout(() => {
        page.minDwellTimer = null;
        finalizePage(run, page);
      }, Math.max(0, Math.ceil(wait)));
    }
    return;
  }
  finalizePage(run, page);
}

function finalizePage(run: Run, page: PageState): void {
  if (page.finalized || run.cancelled) return;
  if (page.minDwellTimer !== null) {
    window.clearTimeout(page.minDwellTimer);
    page.minDwellTimer = null;
  }
  page.finalized = true;
  updatePage(page);
  publishCopy(run);
  checkReady(run);
}

function startTask(run: Run, state: TaskState, page: PageState): void {
  if (run.cancelled) return;
  state.attempt += 1;
  const attempt = state.attempt;
  if (page.startedAt === null) {
    page.startedAt = now();
    updatePage(page);
    publishCopy(run);
  }
  run.inFlight.add(state);

  const controller = new AbortController();
  state.controller = controller;
  const timeout = window.setTimeout(() => {
    // A retry arms a new attempt; stale timers and stale promises must not
    // touch the task after that.
    if (state.attempt !== attempt || state.settled) return;
    controller.abort();
    if (RETRYABLE[state.task.kind] && state.attempt < 2) {
      retryLater(run, state, page);
      return;
    }
    settle(run, state, page, false);
  }, TASK_TIMEOUT_MS[state.task.kind]);
  state.timer = timeout;

  const finish = (ok: boolean) => {
    if (state.attempt !== attempt || state.settled) return;
    if (state.timer !== null) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
    if (ok) {
      settle(run, state, page, true);
      return;
    }
    if (RETRYABLE[state.task.kind] && state.attempt < 2) {
      retryLater(run, state, page);
      return;
    }
    settle(run, state, page, false);
  };

  let result: Promise<unknown>;
  try {
    result = state.task.run(controller.signal);
  } catch {
    finish(false);
    return;
  }
  result.then(
    () => finish(true),
    () => finish(false),
  );
}

function retryLater(run: Run, state: TaskState, page: PageState): void {
  if (run.cancelled) return;
  if (state.timer !== null) {
    window.clearTimeout(state.timer);
    state.timer = null;
  }
  const controller = state.controller;
  state.controller = null;
  controller?.abort();
  run.inFlight.delete(state);
  const delay = RETRY_BASE_MS + Math.random() * 240;
  state.retryTimer = window.setTimeout(() => {
    state.retryTimer = null;
    if (run.cancelled || state.settled) return;
    startTask(run, state, page);
    pump(run);
  }, delay);
}

/** Pick the next task: page order first, then the sorted page queue. */
function pickNext(run: Run): { state: TaskState; page: PageState } | null {
  const hidden = typeof document !== 'undefined' && document.hidden;
  for (const page of run.pages) {
    if (page.finalized) continue;
    // A page with queued work owns the next slot ahead of later pages.
    for (const state of page.queue) {
      if (state.settled || state.controller || state.retryTimer !== null) continue;
      if (hidden && !state.task.critical) continue;
      return { state, page };
    }
  }
  return null;
}

function pump(run: Run): void {
  if (run.cancelled) return;
  const hidden = typeof document !== 'undefined' && document.hidden;
  const limit = hidden ? Math.max(1, Math.min(2, run.concurrency)) : run.concurrency;
  while (run.inFlight.size < limit) {
    const next = pickNext(run);
    if (!next) break;
    const index = next.page.queue.indexOf(next.state);
    if (index >= 0) next.page.queue.splice(index, 1);
    startTask(run, next.state, next.page);
  }
}

function checkReady(run: Run): void {
  if (run.ready || run.cancelled) return;
  const allTasksSettled = run.pages.every((page) =>
    page.tasks.every((task) => task.settled),
  );
  const allPagesFinalized = run.pages.every((page) => page.finalized);
  const criticalSettled = run.pages.every((page) =>
    page.tasks.every((task) => !task.task.critical || task.settled),
  );
  const elapsed = visibleElapsed(run);
  const soft = elapsed >= run.options.softTimeoutMs;
  const hard = elapsed >= run.options.hardTimeoutMs;
  const wallElapsed = now() - run.startedAt;
  const minDurationMet = wallElapsed >= run.options.minDurationMs;

  const cleared =
    (allTasksSettled && allPagesFinalized) ||
    (hard && minDurationMet) ||
    (run.options.revealOnCritical === true && soft && criticalSettled && minDurationMet);

  if (!cleared) return;
  if (!allTasksSettled || !allPagesFinalized) run.degraded = true;
  openGate(run);
}

function openGate(run: Run): void {
  if (run.ready) return;
  run.ready = true;
  for (const page of run.pages) {
    if (!page.finalized) {
      // The hard deadline can fire with work still in flight; show the page as
      // ready so the UI does not leave a stuck row, but keep the work running.
      page.finalized = true;
      updatePage(page);
    }
    if (page.finalized && page.startedAt === null) page.startedAt = run.startedAt;
  }
  patchBoot({
    phase: 'ready',
    progress: 1,
    activePage: null,
    label: 'Ready',
    detail: '',
    degraded: run.degraded,
    slow: false,
    elapsedMs: Math.round(now() - run.startedAt),
  });
  if (run.ticker !== null) {
    window.clearInterval(run.ticker);
    run.ticker = null;
  }
  if (run.readyTimer !== null) {
    window.clearTimeout(run.readyTimer);
    run.readyTimer = null;
  }
  const callback = run.onReady;
  run.onReady = undefined;
  callback?.();
  run.resolve(getBootSnapshot());
}

function startTicker(run: Run): void {
  if (run.ticker !== null) return;
  run.ticker = window.setInterval(() => {
    if (run.cancelled) return;
    const elapsed = Math.round(now() - run.startedAt);
    const slow = !run.ready && visibleElapsed(run) > SLOW_AFTER_MS;
    const last = getBootSnapshot();
    if (Math.abs(elapsed - last.elapsedMs) >= 400 || slow !== last.slow) {
      patchBoot({ elapsedMs: elapsed, slow });
    }
    checkReady(run);
    if (run.ready) return;
    for (const page of run.pages) {
      if (page.finalized) continue;
      if (page.tasks.every((task) => task.settled)) finishPageIfSettled(run, page);
    }
  }, TICK_MS);
}

function cancelRun(run: Run): void {
  if (run.cancelled) return;
  run.cancelled = true;
  for (const page of run.pages) {
    if (page.minDwellTimer !== null) window.clearTimeout(page.minDwellTimer);
    page.minDwellTimer = null;
    for (const state of page.tasks) {
      if (state.timer !== null) window.clearTimeout(state.timer);
      if (state.retryTimer !== null) window.clearTimeout(state.retryTimer);
      state.controller?.abort();
      state.controller = null;
      state.timer = null;
      state.retryTimer = null;
    }
  }
  if (run.ticker !== null) window.clearInterval(run.ticker);
  if (run.readyTimer !== null) window.clearTimeout(run.readyTimer);
  run.ticker = null;
  run.readyTimer = null;
  if (run.visibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', run.visibilityHandler);
  }
  run.visibilityHandler = null;
  run.ready = true;
  run.resolve(getBootSnapshot());
}

export function startBoot(options: BootOptions): BootHandle {
  if (typeof window === 'undefined') {
    return {
      promise: Promise.resolve({ ...getBootSnapshot(), phase: 'ready', progress: 1 }),
      cancel: () => undefined,
    };
  }

  // Only one boot may own the gate.
  if (activeCancel) activeCancel();

  let resolve!: (snapshot: BootSnapshot) => void;
  const promise = new Promise<BootSnapshot>((done) => {
    resolve = done;
  });

  const run: Run = {
    options: {
      ...options,
      firstPage: options.firstPage,
      softTimeoutMs: options.softTimeoutMs ?? 9_000,
      hardTimeoutMs: options.hardTimeoutMs ?? 25_000,
      minDurationMs: options.minDurationMs ?? 900,
    },
    pages: buildPages(options),
    concurrency: Math.max(1, Math.round(options.concurrency ?? deriveConcurrency())),
    inFlight: new Set(),
    settledWeight: 0,
    totalWeight: 0,
    startedAt: now(),
    hiddenAt: typeof document !== 'undefined' && document.hidden ? now() : null,
    hiddenMs: 0,
    ready: false,
    cancelled: false,
    degraded: false,
    slow: false,
    resolve,
    onReady: options.onReady,
    ticker: null,
    readyTimer: null,
    visibilityHandler: null,
  };
  run.totalWeight = run.pages.reduce((sum, page) => sum + page.totalWeight, 0);

  beginBoot(options.pages.map((spec) => spec));

  // A page that carries no work is ready the moment it exists; without this it
  // would never finalize and would hold the gate shut forever.
  for (const page of run.pages) {
    if (page.tasks.length === 0) {
      page.startedAt = run.startedAt;
      page.finalized = true;
      updatePage(page);
    }
  }
  if (run.hiddenAt !== null) patchBoot({ slow: false });

  if (run.totalWeight === 0 || run.pages.length === 0) {
    run.readyTimer = window.setTimeout(() => openGate(run), run.options.minDurationMs);
    startTicker(run);
    activeCancel = () => cancelRun(run);
    return { promise, cancel: () => cancelRun(run) };
  }

  const visibility = () => {
    if (run.cancelled || run.ready) return;
    if (document.hidden) {
      run.hiddenAt = now();
    } else {
      if (run.hiddenAt !== null) {
        run.hiddenMs += now() - run.hiddenAt;
        run.hiddenAt = null;
      }
      pump(run);
      checkReady(run);
    }
  };
  run.visibilityHandler = visibility;
  document.addEventListener('visibilitychange', visibility);

  startTicker(run);
  pump(run);
  checkReady(run);

  const handle: BootHandle = {
    promise,
    cancel: () => {
      cancelRun(run);
      activeCancel = null;
    },
  };
  activeCancel = handle.cancel;
  return handle;
}
