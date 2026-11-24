import { useEffect, useRef } from 'react';
import { useBootSnapshot } from '../../load/bootStore';
import type { PageId, PageStatus } from '../../load/types';
import '../../styles/boot.css';

/**
 * The boot screen is content only: the gate owns the fixed veil around it.
 *
 * Bars never re-render. The snapshot is mirrored into refs, a single rAF loop
 * eases the displayed values toward them and writes the transforms straight to
 * the DOM, so a chatty store cannot cause a React render per frame.
 */

/** Chase speed toward the snapshot, in "per second" units. */
const EASE_RATE = 10;
/** Close enough: snap, paint, and let the loop stop. */
const EASE_EPSILON = 0.0006;

const FALLBACK_LABEL = 'Opening the palace';
const FALLBACK_DETAIL = 'Gathering the first light.';

const PAGE_STATE: Record<PageStatus, string> = {
  queued: 'Queued',
  loading: 'Loading',
  ready: 'Ready',
  failed: 'Failed',
};

interface BootTargets {
  overall: number;
  pages: Map<PageId, number>;
}

interface BootValues {
  overall: number;
  pages: Map<PageId, number>;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** One exponential step; returns the target once it is within a hair of it. */
function approach(current: number, target: number, factor: number): number {
  const next = current + (target - current) * factor;
  return Math.abs(target - next) <= EASE_EPSILON ? target : next;
}

function scaleX(value: number): string {
  return `scaleX(${clamp01(value).toFixed(4)})`;
}

export default function BootScreen() {
  const snapshot = useBootSnapshot();

  const overallFillRef = useRef<HTMLSpanElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const pageFillRefs = useRef(new Map<PageId, HTMLSpanElement>());
  const targetsRef = useRef<BootTargets>({ overall: 0, pages: new Map() });
  const valuesRef = useRef<BootValues>({ overall: 0, pages: new Map() });

  // Mirror the store into plain numbers before the loop reads them.
  useEffect(() => {
    const targets = targetsRef.current;
    const values = valuesRef.current;

    targets.overall = clamp01(snapshot.progress);
    targets.pages.clear();
    for (const page of snapshot.pages) {
      targets.pages.set(page.id, clamp01(page.progress));
    }

    // A reset (QA, hot reload) drops rows; drop their cached values as well.
    for (const id of Array.from(values.pages.keys())) {
      if (!targets.pages.has(id)) values.pages.delete(id);
    }
  }, [snapshot]);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = targetsRef.current;
    const values = valuesRef.current;

    const paint = () => {
      const overall = overallFillRef.current;
      if (overall) overall.style.transform = scaleX(values.overall);

      const percent = percentRef.current;
      if (percent) percent.textContent = `${Math.round(values.overall * 100)}%`;

      for (const id of targets.pages.keys()) {
        const node = pageFillRefs.current.get(id);
        if (node) node.style.transform = scaleX(values.pages.get(id) ?? 0);
      }
    };

    // Reduced motion: no chase, just the honest numbers, painted once.
    if (reduced) {
      values.overall = targets.overall;
      for (const [id, target] of targets.pages) values.pages.set(id, target);
      paint();
      return;
    }

    let raf = 0;
    let last = 0;

    const step = (now: number) => {
      if (last === 0) last = now;
      const dt = Math.min(0.064, Math.max(0.001, (now - last) / 1000));
      last = now;
      const factor = 1 - Math.exp(-EASE_RATE * dt);

      values.overall = approach(values.overall, targets.overall, factor);
      let settled = values.overall === targets.overall;

      for (const [id, target] of targets.pages) {
        const next = approach(values.pages.get(id) ?? 0, target, factor);
        values.pages.set(id, next);
        if (next !== target) settled = false;
      }

      paint();
      if (!settled) raf = requestAnimationFrame(step);
    };

    paint();
    raf = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf);
  }, [snapshot]);

  const label = snapshot.label.trim() || FALLBACK_LABEL;
  const detail = snapshot.detail.trim() || FALLBACK_DETAIL;
  const percent = Math.round(clamp01(snapshot.progress) * 100);
  const pagesBusy = snapshot.pages.some((page) => page.status === 'loading');

  return (
    <div className="boot__content">
      <div className="boot__head">
        <p className="boot__kicker">The Palace of Many Worlds</p>
        <span className="boot__rule" aria-hidden="true" />
      </div>

      <div className="boot__status" role="status" aria-live="polite" aria-atomic="true">
        <p className="boot__label">{label}</p>
        <p className="boot__detail">{detail}</p>
        {snapshot.slow ? (
          <p className="boot__note">A slower connection — still arriving.</p>
        ) : null}
        {snapshot.degraded ? (
          <p className="boot__note boot__note--quiet">
            Some optional detail will arrive later.
          </p>
        ) : null}
      </div>

      <div className="boot__meter">
        <span
          className="boot__bar"
          role="progressbar"
          aria-label="Opening the palace"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span className="boot__bar-fill" ref={overallFillRef} aria-hidden="true" />
        </span>
        <span className="boot__percent" ref={percentRef} aria-hidden="true" />
      </div>

      {snapshot.pages.length > 0 ? (
        <ul className="boot__pages" aria-busy={pagesBusy}>
          {snapshot.pages.map((page) => (
            <li className="boot__page" key={page.id} data-state={page.status}>
              <span className="boot__page-label">{page.label}</span>
              <span
                className="boot__page-bar"
                role="progressbar"
                aria-label={`${page.label} loading`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(clamp01(page.progress) * 100)}
              >
                <span
                  className="boot__page-fill"
                  aria-hidden="true"
                  ref={(node) => {
                    if (node) pageFillRefs.current.set(page.id, node);
                    else pageFillRefs.current.delete(page.id);
                  }}
                />
              </span>
              <span className="boot__page-state">{PAGE_STATE[page.status]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
