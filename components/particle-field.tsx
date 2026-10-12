"use client";

import { useEffect, useRef } from "react";
import { pointer, trackPointer } from "@/lib/pointer";

/**
 * ParticleField — a flow-field particle system on a 2D canvas.
 *
 * How it reads as "alive" rather than "noise":
 *   1. FLOW FIELD  particles steer by a curl-like field built from layered
 *      sin/cos, so motion forms visible currents instead of jitter
 *   2. TRAILS      each frame erases only ~8% of the previous frame, leaving
 *      comet tails (destination-out keeps the canvas transparent)
 *   3. CURSOR      particles are pushed away from the pointer and speed up,
 *      and a link is drawn from each nearby particle to the cursor
 *   4. LINKS       nearby particles join with faint lines (constellation)
 *
 * Performance rules (unchanged from the original brief):
 *   - skipped entirely on mobile / coarse pointers
 *   - skipped entirely under prefers-reduced-motion
 *   - frozen by IntersectionObserver when scrolled out of view or tab hidden
 *   - devicePixelRatio capped at 2
 *   - squared-distance early exits in the link loop
 */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  /** 0 → primary coral, 1 → pale pink */
  tint: number;
};

const COLORS = {
  primary: [237, 120, 120] as const,
  secondary: [246, 208, 208] as const,
  accent: [229, 143, 143] as const,
};

const MAX_PARTICLES = 120;
const LINK_DIST = 128;
const LINK_DIST_SQ = LINK_DIST * LINK_DIST;
const CURSOR_DIST = 165;
const CURSOR_DIST_SQ = CURSOR_DIST * CURSOR_DIST;
/** particles per px², tuned so a 1440px hero lands near MAX_PARTICLES */
const DENSITY = 1 / 13500;

export function ParticleField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Accessibility + mobile guards
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 768px)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    trackPointer();

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let raf = 0;
    let running = true;
    let time = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(Math.floor(width * dpr), 1);
      canvas.height = Math.max(Math.floor(height * dpr), 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const seed = () => {
      const target = Math.min(Math.floor(width * height * DENSITY), MAX_PARTICLES);
      particles = Array.from({ length: Math.max(target, 28) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 1.5 + 0.6,
        tint: Math.random(),
      }));
    };

    /** Layered sin/cos field — cheap, smooth, and seamless when wrapped. */
    const flowAngle = (x: number, y: number, t: number) =>
      Math.sin(x * 0.0022 + t) * 1.7 +
      Math.cos(y * 0.0026 - t * 0.85) * 1.7 +
      Math.sin((x + y) * 0.0013 + t * 0.5) * 1.1;

    const wrap = (value: number, max: number) => {
      if (value < -30) return max + 30;
      if (value > max + 30) return -30;
      return value;
    };

    const frame = () => {
      time += 0.0024;

      // Fade the previous frame instead of clearing it → trails.
      // destination-out removes alpha only, so the canvas stays transparent.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.085)";
      ctx.fillRect(0, 0, width, height);

      // Additive blending makes overlaps glow against the dark background.
      ctx.globalCompositeOperation = "lighter";

      const cursorActive = pointer.active && pointer.x > -1000;

      for (const p of particles) {
        // --- steer along the flow field ---
        const angle = flowAngle(p.x, p.y, time);
        p.vx += Math.cos(angle) * 0.035;
        p.vy += Math.sin(angle) * 0.035;

        // --- cursor repulsion ---
        if (cursorActive) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < CURSOR_DIST_SQ && distSq > 0.01) {
            const dist = Math.sqrt(distSq);
            const force = (1 - dist / CURSOR_DIST) * 0.85;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        // damping keeps speeds bounded; a floor prevents stalling
        p.vx *= 0.955;
        p.vy *= 0.955;
        const speedSq = p.vx * p.vx + p.vy * p.vy;
        if (speedSq < 0.0025) {
          p.vx += (Math.random() - 0.5) * 0.05;
          p.vy += (Math.random() - 0.5) * 0.05;
        }
        if (speedSq > 16) {
          const scale = 4 / Math.sqrt(speedSq);
          p.vx *= scale;
          p.vy *= scale;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.x = wrap(p.x, width);
        p.y = wrap(p.y, height);

        // --- draw node, brighter when moving fast ---
        const speed = Math.min(Math.sqrt(speedSq) / 3, 1);
        const rgb = p.tint > 0.5 ? COLORS.secondary : COLORS.primary;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + speed * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${0.4 + speed * 0.5})`;
        ctx.fill();
      }

      // --- links between nearby particles, plus links to the cursor ---
      ctx.lineWidth = 0.7;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];

        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          if (dx > LINK_DIST || dx < -LINK_DIST) continue;
          const dy = a.y - b.y;
          if (dy > LINK_DIST || dy < -LINK_DIST) continue;
          const distSq = dx * dx + dy * dy;
          if (distSq > LINK_DIST_SQ) continue;

          const alpha = (1 - Math.sqrt(distSq) / LINK_DIST) * 0.34;
          const accent = COLORS.accent;
          ctx.strokeStyle = `rgba(${accent[0]}, ${accent[1]}, ${accent[2]}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        if (cursorActive) {
          const dx = a.x - pointer.x;
          const dy = a.y - pointer.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < CURSOR_DIST_SQ) {
            const alpha = (1 - Math.sqrt(distSq) / CURSOR_DIST) * 0.4;
            const primary = COLORS.primary;
            ctx.strokeStyle = `rgba(${primary[0]}, ${primary[1]}, ${primary[2]}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
      }

      ctx.globalCompositeOperation = "source-over";
      if (running) raf = requestAnimationFrame(frame);
    };

    resize();

    // Freeze when off-screen or when the tab is hidden.
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && document.visibilityState === "visible";
        if (visible && !running) {
          running = true;
          raf = requestAnimationFrame(frame);
        } else if (!visible && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    const onVisibility = () => {
      if (document.visibilityState === "hidden" && running) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (document.visibilityState === "visible" && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };

    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    frame();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="particle-field"
      className={className}
    />
  );
}
