import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useBootSnapshot } from '../../load/bootStore';
import { lockScroll } from '../../scrollLock';
import BootScreen from './BootScreen';

/**
 * Holds the site behind a full-screen veil until the boot store says the pages
 * are ready, then hands over: the site mounts underneath, paints for two frames
 * and a beat, and the veil fades and is dropped from the DOM.
 *
 * The gate never invents readiness. `phase` only turns 'ready' when the
 * scheduler opens it, so a stalled load leaves the veil (and the scroll lock)
 * in place rather than revealing a half-built site.
 */

const FADE_MS = 480;
const FADE_MS_REDUCED = 120;
/** One breath after the first painted frame, so the reveal does not snap. */
const PAINT_BEAT_MS = 80;
/**
 * How long the veil holds after readiness, before it gives way. A randomised
 * breath between 3 and 5 seconds keeps the handoff from ever reading as a
 * countdown and lets the loading screen own the pacing.
 */
const HOLD_MS = 3000 + Math.random() * 2000;

export interface BootGateProps {
  children: ReactNode;
  /** QA / fast path: no veil, no scroll lock, no waiting. */
  skip?: boolean;
  onRevealed?: () => void;
}

export default function BootGate({ children, skip = false, onRevealed }: BootGateProps) {
  const snapshot = useBootSnapshot();
  const [exiting, setExiting] = useState(false);
  const [finished, setFinished] = useState(false);

  const onRevealedRef = useRef(onRevealed);
  const notifiedRef = useRef(false);

  const ready = snapshot.phase === 'ready';
  // Children only exist once ready, so the veil stays up whenever they are not.
  const veilUp = !skip && (!finished || !ready);

  useEffect(() => {
    onRevealedRef.current = onRevealed;
  }, [onRevealed]);

  // A reset (QA, hot reload) sends the store back to idle: re-arm the veil so a
  // second run fades in the same way instead of exposing the site mid-load.
  useEffect(() => {
    if (ready) return;
    setExiting(false);
    setFinished(false);
  }, [ready]);

  // Hold the page still while the veil is up. The lock is shared and counted,
  // so the prologue — which mounts while the veil is still fading — releases
  // into the same lock instead of restoring the veil's 'hidden' as its own
  // previous value and freezing scroll after the handover.
  useEffect(() => {
    if (!veilUp) return;
    return lockScroll();
  }, [veilUp]);

  // Reveal: mount the site behind the veil, let it paint, then fade and drop.
  useEffect(() => {
    if (skip || !ready || finished) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fadeMs = reduced ? FADE_MS_REDUCED : FADE_MS;

    let cancelled = false;
    let beatTimer = 0;
    let fadeTimer = 0;

    const startFade = () => {
      // A short beat after the second frame keeps the first reveal from
      // competing with the fade for the same paint.
      beatTimer = window.setTimeout(() => {
        if (cancelled) return;
        setExiting(true);

        fadeTimer = window.setTimeout(() => {
          if (cancelled) return;
          setFinished(true);
          if (!notifiedRef.current) {
            notifiedRef.current = true;
            onRevealedRef.current?.();
          }
        }, fadeMs);
      }, PAINT_BEAT_MS);
    };
    const holdTimer = window.setTimeout(() => {
      if (cancelled) return;
      startFade();
    }, HOLD_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(beatTimer);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(holdTimer);
    };
  }, [skip, ready, finished]);

  if (skip) return <>{children}</>;

  const overlayClass = `boot${ready ? ' boot--ready' : ''}${
    exiting && ready ? ' boot--exiting' : ''
  }`;

  return (
    <>
      {ready ? children : null}
      {veilUp ? (
        <div className={overlayClass}>
          <BootScreen />
        </div>
      ) : null}
    </>
  );
}
