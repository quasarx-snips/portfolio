import { useEffect, type RefObject } from 'react';
import { useFilm } from './film';
import { useViewMode } from './useViewMode';
import { smoothstep } from './easing';

/**
 * Maximum parallax travel, in CSS pixels. This is deliberately tiny: the
 * pointer should feel like a camera settling, not a page being shaken.
 */
const PARALLAX_X = 4;
const PARALLAX_Y = 2.8;
/** Just enough zoom to hide the edges while the frame drifts. */
const CAMERA_SCALE = 1.02;

/** Spring constants for the camera lag (normalised pointer units, seconds). */
const STIFFNESS = 70;
const DAMPING = 15;

/**
 * Pointer camera.
 *
 * The stage follows the pointer with a lightly damped spring: it drifts a few
 * pixels against the pointer, lags slightly behind quick movements and settles
 * when the mouse stops. No oscillation loop, no jitter, no vibration.
 *
 * Skipped entirely for touch, coarse pointers and reduced motion.
 */
export default function PointerCamera({
  targetRef,
}: {
  targetRef: RefObject<HTMLDivElement | null>;
}) {
  const film = useFilm();
  const { reduced } = useViewMode();

  // A passive effect, not a layout effect: the stage ref is attached by the
  // time this runs, even though PointerCamera is a child of the stage.
  useEffect(() => {
    const stage = targetRef.current;
    if (!stage || reduced) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let velocityX = 0;
    let velocityY = 0;

    let raf = 0;
    let lastFrame = performance.now();

    const reset = () => {
      targetX = 0;
      targetY = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      targetX = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1));
      targetY = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1));
    };

    const onPointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) reset();
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);

      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;

      const accelerationX = (targetX - x) * STIFFNESS - velocityX * DAMPING;
      const accelerationY = (targetY - y) * STIFFNESS - velocityY * DAMPING;
      velocityX += accelerationX * dt;
      velocityY += accelerationY * dt;
      x += velocityX * dt;
      y += velocityY * dt;

      const amplitude = 1 - smoothstep(film.frame.p, 0.86, 0.97);
      const translateX = -x * PARALLAX_X * amplitude;
      const translateY = -y * PARALLAX_Y * amplitude;
      const rotate = (x * 0.09 + velocityX * 0.006) * amplitude;

      stage.style.transform = `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(
        2,
      )}px, 0) rotate(${rotate.toFixed(3)}deg) scale(${CAMERA_SCALE})`;
    };

    raf = requestAnimationFrame(tick);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerout', onPointerOut);
    window.addEventListener('blur', reset);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerout', onPointerOut);
      window.removeEventListener('blur', reset);
      stage.style.transform = '';
    };
  }, [film, reduced, targetRef]);

  return null;
}
