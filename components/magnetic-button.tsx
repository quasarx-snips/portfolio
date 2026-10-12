"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useRef, type ReactNode } from "react";

/**
 * MagneticButton — the Skipper UI "magnetic hover" pattern.
 *
 * The button leans toward the cursor while it is nearby, then springs back
 * on leave. Uses motion values (not React state) so pointer moves never
 * trigger a re-render.
 *
 * Renders as a real anchor so it stays keyboard-focusable, right-clickable
 * and crawlable. On touch devices / reduced-motion it is a plain link.
 */
export function MagneticButton({
  children,
  href,
  strength = 0.35,
  className,
  onClick,
}: {
  children: ReactNode;
  href: string;
  /** how far it follows the cursor, in fraction of distance */
  strength?: number;
  className?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduceMotion = useReducedMotion();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 220, damping: 18, mass: 0.4 });
  const y = useSpring(rawY, { stiffness: 220, damping: 18, mass: 0.4 });

  if (reduceMotion) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <motion.a
      ref={ref}
      href={href}
      style={{ x, y }}
      onPointerMove={(event) => {
        const el = ref.current;
        if (!el) return;
        // ignore touch — magnetic hover is a pointer-only nicety
        if (event.pointerType !== "mouse") return;

        const rect = el.getBoundingClientRect();
        const offsetX = event.clientX - (rect.left + rect.width / 2);
        const offsetY = event.clientY - (rect.top + rect.height / 2);
        rawX.set(offsetX * strength);
        rawY.set(offsetY * strength);
      }}
      onPointerLeave={() => {
        rawX.set(0);
        rawY.set(0);
      }}
      className={className}
    >
      {children}
    </motion.a>
  );
}
