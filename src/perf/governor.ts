/**
 * Frame-time governor for the WebGL prologue.
 *
 * Resolution is the one dial that buys a smooth frame without changing the
 * composition: the black hole is a per-pixel march, so cost scales with the
 * backing store, and a soft nebula upscaled from 0.6x is visually free.
 *
 * The loop drops quickly (two slow frames) and recovers slowly (thirty fast
 * frames), which finds the highest scale a device can actually sustain instead
 * of oscillating every other frame.
 */

export interface FrameGovernorOptions {
  /** Desired frame rate; defaults to 60. */
  targetFps?: number;
  /** Lower bound for the returned scale; defaults to 0.5. */
  minScale?: number;
  /** Upper bound for the returned scale; defaults to 1. */
  maxScale?: number;
}

export interface FrameSamplerOptions extends FrameGovernorOptions {
  /** Throttle for unchanged reports; defaults to 500ms (2 reports/sec). */
  reportIntervalMs?: number;
}

/** EMA weight: ~10 frames to converge, slow enough to ignore single spikes. */
const EMA_ALPHA = 0.1;
/** Tab wake, GC or a compositor stall is not a rendering trend. */
const MAX_DELTA_MS = 140;

const DROP_AFTER = 2;
/** 8% over budget, so harmless 60Hz jitter never counts as slow. */
const DROP_RATIO = 1.08;
const RECOVER_AFTER = 30;
/** At or under 2% over budget counts as healthy; 60Hz rAF lands here. */
const RECOVER_RATIO = 1.02;
const RECOVER_STEP = 1.04;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

export class FrameGovernor {
  private readonly budgetMs: number;

  private readonly minScale: number;

  private readonly maxScale: number;

  private emaMs: number;

  private value: number;

  private slowRun = 0;

  private fastRun = 0;

  constructor(options: FrameGovernorOptions = {}) {
    const targetFps = clamp(options.targetFps ?? 60, 24, 144);
    this.budgetMs = 1000 / targetFps;
    this.minScale = clamp(options.minScale ?? 0.5, 0.25, 1);
    this.maxScale = clamp(options.maxScale ?? 1, this.minScale, 1);
    this.emaMs = this.budgetMs;
    this.value = this.maxScale;
  }

  /** Current resolution scale, always within [minScale, maxScale]. */
  get scale(): number {
    return this.value;
  }

  /** Smoothed frame rate, rounded for display. */
  get fps(): number {
    return Math.round(1000 / this.emaMs);
  }

  reset(): void {
    this.value = this.maxScale;
    this.emaMs = this.budgetMs;
    this.slowRun = 0;
    this.fastRun = 0;
  }

  /** Feed one frame delta in ms; returns the scale to use for the next frame. */
  sample(deltaMs: number): number {
    // Ignore pauses, hidden-tab deltas and bad input. No allocation on purpose.
    if (!(deltaMs > 0) || deltaMs > MAX_DELTA_MS || !Number.isFinite(deltaMs)) {
      return this.value;
    }

    this.emaMs += (deltaMs - this.emaMs) * EMA_ALPHA;
    const ratio = this.emaMs / this.budgetMs;

    if (deltaMs > this.budgetMs * DROP_RATIO) {
      this.fastRun = 0;
      this.slowRun += 1;
      if (this.slowRun >= DROP_AFTER) {
        // Shed harder when the average frame is far past budget, not just
        // when a single frame was. ratio comes from the EMA, so it is stable.
        const step = ratio > 1.75 ? 0.82 : ratio > 1.3 ? 0.87 : 0.9;
        this.value = Math.max(this.minScale, this.value * step);
        this.slowRun = 0;
      }
      return this.value;
    }

    if (deltaMs < this.budgetMs * RECOVER_RATIO) {
      this.slowRun = 0;
      this.fastRun += 1;
      if (this.fastRun >= RECOVER_AFTER) {
        // Probe upward gently; a drop costs two frames, recovery costs ~0.5s.
        this.value = Math.min(this.maxScale, this.value * RECOVER_STEP);
        this.fastRun = 0;
      }
      return this.value;
    }

    // In the hysteresis band: hold the current scale and forget both runs.
    this.slowRun = 0;
    this.fastRun = 0;
    return this.value;
  }
}

/**
 * rAF loop that owns a FrameGovernor. Stops itself while the tab is hidden and
 * resumes on visibility, so background tabs cost nothing. Reports at most
 * twice a second unless the scale actually changes.
 *
 * Returns a disposer; calling it twice is safe.
 *
 * Pass `{ targetFps: quality.targetFps }` when the tier wants 30fps; the
 * default governor target is 60.
 */
export function createFrameSampler(
  onScale: (scale: number, fps: number) => void,
  options: FrameSamplerOptions = {},
): () => void {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof requestAnimationFrame !== 'function'
  ) {
    return () => undefined;
  }

  const governor = new FrameGovernor(options);
  const reportIntervalMs = clamp(options.reportIntervalMs ?? 500, 100, 5000);

  let rafId = 0;
  let lastFrameMs = 0;
  let hasLastFrame = false;
  let lastReportMs = 0;
  let lastReportedScale = -1;
  let disposed = false;

  const report = (nowMs: number, scale: number, force: boolean): void => {
    if (!force && nowMs - lastReportMs < reportIntervalMs) return;
    lastReportMs = nowMs;
    lastReportedScale = scale;
    onScale(scale, governor.fps);
  };

  const frame = (nowMs: number): void => {
    rafId = 0;
    if (disposed) return;

    // The first frame only establishes a timestamp. A boolean is used
    // because 0 is a legal rAF timestamp.
    if (hasLastFrame) {
      const scale = governor.sample(nowMs - lastFrameMs);
      report(nowMs, scale, scale !== lastReportedScale);
    }
    lastFrameMs = nowMs;
    hasLastFrame = true;

    if (!disposed && !document.hidden) {
      rafId = requestAnimationFrame(frame);
    }
  };

  const start = (): void => {
    if (disposed || rafId !== 0 || document.hidden) return;
    // Drop the stale timestamp so the wake delta is never sampled.
    lastFrameMs = 0;
    hasLastFrame = false;
    lastReportMs = 0;
    lastReportedScale = -1;
    rafId = requestAnimationFrame(frame);
  };

  const stop = (): void => {
    if (rafId !== 0) cancelAnimationFrame(rafId);
    rafId = 0;
    lastFrameMs = 0;
    hasLastFrame = false;
  };

  const onVisibilityChange = (): void => {
    if (document.hidden) stop();
    else start();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  start();

  return () => {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    stop();
  };
}
