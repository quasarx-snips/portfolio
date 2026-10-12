/**
 * Pointer — one global pointer store shared by every interactive layer
 * (custom cursor, particle field, card tilts).
 *
 * Why a module singleton instead of a listener per component:
 *   - one `pointermove` listener for the entire page instead of dozens
 *   - values are written synchronously (cheap) and read inside each
 *     component's own requestAnimationFrame loop, so pointer movement
 *     never triggers a React re-render
 */

export type PointerSnapshot = {
  x: number;
  y: number;
  /** previous position, for velocity */
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** normalised -1..1 from viewport centre */
  nx: number;
  ny: number;
  active: boolean;
  pressed: boolean;
};

export const pointer: PointerSnapshot = {
  x: -9999,
  y: -9999,
  px: -9999,
  py: -9999,
  vx: 0,
  vy: 0,
  nx: 0,
  ny: 0,
  active: false,
  pressed: false,
};

let started = false;

/** Idempotent — safe to call from every component that needs pointer data. */
export function trackPointer(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  const onMove = (event: PointerEvent) => {
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.vx = pointer.x - pointer.px;
    pointer.vy = pointer.y - pointer.py;
    pointer.nx = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.ny = (event.clientY / window.innerHeight) * 2 - 1;
    pointer.active = true;
  };

  const onLeave = () => {
    pointer.active = false;
    pointer.x = -9999;
    pointer.y = -9999;
  };

  const onDown = () => {
    pointer.pressed = true;
  };

  const onUp = () => {
    pointer.pressed = false;
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });
  document.addEventListener("pointerleave", onLeave);
}

/**
 * True when the device has a precise pointer (mouse/trackpad). Touch
 * devices get none of the hover-only flourishes.
 */
export function hasFinePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** True when the user asked the OS to reduce motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
