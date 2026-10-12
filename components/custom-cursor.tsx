"use client";

import { useEffect, useRef } from "react";
import { hasFinePointer, prefersReducedMotion, trackPointer } from "@/lib/pointer";

/**
 * CustomCursor — a small dot locked 1:1 to the pointer plus a larger ring
 * that trails behind it (0.16 lerp), which is what creates the "elastic
 * follow" feel without ever making the actual pointer feel laggy.
 *
 * Behaviour:
 *   - the ring inflates and fills when over anything interactive, found via
 *     one delegated `pointerover` listener using `closest()`
 *   - the ring contracts on press, like a real click
 *   - mounts ONLY on fine-pointer devices with motion allowed, so touch
 *     users keep their native cursor and reduced-motion users see nothing
 *
 * Cost: one rAF loop that writes transforms directly to two DOM nodes,
 * and only while something is actually moving. Zero React state, so
 * pointer movement never re-renders the tree.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasFinePointer() || prefersReducedMotion()) return;

    trackPointer();
    document.documentElement.classList.add("has-custom-cursor");

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let dotX = mouseX;
    let dotY = mouseY;
    let ringX = mouseX;
    let ringY = mouseY;
    let hovering = false;
    let raf = 0;
    let dotDirty = false;

    const onMove = (event: PointerEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      dotDirty = true;

      // one delegated hit-test for the whole document
      const target = event.target as Element | null;
      const hit = target?.closest?.(
        'a, button, input, textarea, select, summary, [role="button"], [data-cursor="hover"]',
      );
      const next = Boolean(hit);
      if (next !== hovering) {
        hovering = next;
        ring.dataset.state = next ? "hover" : "idle";
      }
    };

    const onDown = () => {
      ring.dataset.state = "press";
    };

    const onUp = () => {
      ring.dataset.state = hovering ? "hover" : "idle";
    };

    const onLeave = () => {
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    };

    const onEnter = () => {
      dot.style.opacity = "1";
      ring.style.opacity = "1";
    };

    // paint the starting position once so neither element flashes at (0, 0)
    dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;
    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;

    const loop = () => {
      // the dot is locked 1:1 to the pointer — easing it reads as input lag
      if (dotDirty) {
        dotDirty = false;
        dotX = mouseX;
        dotY = mouseY;
        dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;
      }

      // the ring lags behind for the trail; skip the write once it settles
      const dx = mouseX - ringX;
      const dy = mouseY - ringY;
      if (Math.abs(dx) + Math.abs(dy) > 0.05) {
        ringX += dx * 0.16;
        ringY += dy * 0.16;
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      }

      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerenter", onEnter);
    loop();

    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerenter", onEnter);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999] hidden md:block">
      {/* trailing ring — reacts to hover state via data-state */}
      <div
        ref={ringRef}
        data-state="idle"
        className="cursor-ring absolute top-0 left-0 h-9 w-9 rounded-full border border-primary/70 bg-primary/0 data-[state=hover]:h-16 data-[state=hover]:w-16 data-[state=hover]:border-primary data-[state=hover]:bg-primary/15 data-[state=press]:h-10 data-[state=press]:w-10 data-[state=press]:bg-primary/30"
      />
      {/* leading dot */}
      <div
        ref={dotRef}
        className="absolute top-0 left-0 h-1.5 w-1.5 rounded-full bg-secondary shadow-[0_0_12px_2px_var(--primary)]"
      />
    </div>
  );
}
