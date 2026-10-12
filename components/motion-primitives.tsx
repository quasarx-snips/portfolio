"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, type ReactNode } from "react";

/**
 * FadeIn — the Motion Primitives pattern.
 *
 * Animates opacity + a small upward translate once the element scrolls
 * into view, then never repeats. Server-rendered content stays in the DOM
 * (good for SEO); only the animation is client-side.
 *
 * If the user prefers reduced motion, this renders as a plain wrapper with
 * no transform at all.
 */
export function FadeIn({
  children,
  delay = 0,
  y = 24,
  duration = 0.6,
  className,
  as = "div",
}: {
  children: ReactNode;
  /** seconds to wait before starting — use for stagger */
  delay?: number;
  /** pixels to travel up from */
  y?: number;
  duration?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "header" | "span";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px 0px -80px 0px" });
  const reduceMotion = useReducedMotion();

  const MotionTag = motion[as] as typeof motion.div;

  if (reduceMotion) {
    const Tag = as as "div";
    return (
      <Tag ref={ref} className={className}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionTag>
  );
}

/**
 * TextReveal — reveals a headline word-by-word with a soft upward blur-in.
 * Words stay as real text nodes so copy-paste and screen readers work.
 */
export function TextReveal({
  text,
  className,
  delay = 0,
  stagger = 0.06,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();
  const words = text.split(" ");

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span ref={ref} className={className}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "110%", opacity: 0, filter: "blur(6px)" }}
            animate={
              inView
                ? { y: "0%", opacity: 1, filter: "blur(0px)" }
                : { y: "110%", opacity: 0, filter: "blur(6px)" }
            }
            transition={{
              duration: 0.7,
              delay: delay + i * stagger,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
