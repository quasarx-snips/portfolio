"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { hasFinePointer, prefersReducedMotion } from "@/lib/pointer";

/**
 * TiltCard — 3D perspective tilt that follows the pointer, plus a spotlight
 * glow that tracks the cursor across the card surface.
 *
 * Implementation notes:
 *   - the DOM is IDENTICAL on server and client (the pointer capability is
 *     only consulted inside the event handlers), so there is no hydration
 *     mismatch — checking `matchMedia` during render would produce one
 *   - pointer work is coalesced into one requestAnimationFrame tick: a
 *     gaming mouse reports up to 1000 Hz, so this caps the card at one
 *     rect read + two style writes per frame instead of per event
 *   - rotation is written straight to inline styles, so pointer movement
 *     never triggers a React re-render
 *   - the spring-back on leave is a CSS transition, disabled while tilting so
 *     the card tracks the pointer 1:1 instead of lagging
 *   - on touch devices / reduced-motion the handlers simply do nothing, so the
 *     card behaves as a normal static card
 */
export function TiltCard({
  children,
  className = "",
  maxTilt = 6,
}: {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef(0);

  // unmount safety — a pending frame must not fire against a detached node
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /** Applies the latest pointer position — at most once per frame. */
  const applyTilt = () => {
    rafRef.current = 0;
    const el = ref.current;
    const pos = posRef.current;
    if (!el || !pos) return;

    const rect = el.getBoundingClientRect();
    const px = (pos.x - rect.left) / rect.width;
    const py = (pos.y - rect.top) / rect.height;

    // spotlight position, for the radial-gradient overlay
    el.style.setProperty("--spot-x", `${px * 100}%`);
    el.style.setProperty("--spot-y", `${py * 100}%`);

    // rotateY follows horizontal, rotateX follows vertical (inverted)
    const rotateY = (px - 0.5) * 2 * maxTilt;
    const rotateX = (0.5 - py) * 2 * maxTilt;

    el.style.transition = "none";
    el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    // hover-only flourish: skip touch, and skip if the user wants less motion
    if (event.pointerType !== "mouse") return;
    if (!hasFinePointer() || prefersReducedMotion()) return;

    posRef.current = { x: event.clientX, y: event.clientY };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(applyTilt);
  };

  const onPointerLeave = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    posRef.current = null;
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform 600ms var(--ease-out-expo)";
    el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
  };

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={`group/tilt relative [transform-style:preserve-3d] ${className}`}
    >
      {/* spotlight overlay — above the card fill, below the content */}
      <div
        aria-hidden="true"
        className="spotlight pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-100"
      />
      {children}
    </div>
  );
}

