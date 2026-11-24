/**
 * Shared scroll lock.
 *
 * Two owners can hold the page still at the same time — the boot veil and the
 * prologue — and each must restore the overflow that existed before *anyone*
 * locked, not whatever the other owner happened to write last. A reference
 * count keeps the inline styles hidden until the final release, then restores
 * the values captured before the first lock.
 */

let depth = 0;
let saved: { html: string; body: string } | null = null;

/** Lock document scrolling; returns an idempotent release function. */
export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  if (depth === 0) {
    saved = {
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
    };
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
  depth += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    depth = Math.max(0, depth - 1);
    if (depth === 0 && saved) {
      document.documentElement.style.overflow = saved.html;
      document.body.style.overflow = saved.body;
      saved = null;
    }
  };
}
