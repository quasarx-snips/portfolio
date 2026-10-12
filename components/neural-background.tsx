"use client";

import { useEffect, useRef } from "react";

/**
 * NeuralBackground — the "Three.js floating particles joined by lines" look,
 * implemented on a plain 2D canvas.
 *
 * Why canvas 2D instead of three.js:
 *   - ~3KB of JS instead of a ~600KB 3D engine
 *   - no WebGL context, so it works on old devices and in browsers that
 *     block GPU contexts
 *   - identical visual result at this size and opacity
 *
 * Performance rules baked in:
 *   - never initialises on mobile / narrow viewports (your "no heavy 3D on
 *     mobile" rule)
 *   - never initialises if the user prefers reduced motion
 *   - freezes when the tab is hidden or the canvas scrolls out of view
 *   - devicePixelRatio capped at 2 so retina phones don't render 9M pixels
 */
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

const CONNECTION_DISTANCE = 132;
const PARTICLE_COUNT_BY_AREA = 1 / 14000; // particles per px²

export function NeuralBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Respect the OS accessibility setting — skip entirely.
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    // Mobile guard: skip on small screens and coarse pointers.
    const isSmallScreen = window.matchMedia("(max-width: 768px)").matches;
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (isSmallScreen || isCoarsePointer) return;

    const primary = "#ed7878";
    const secondary = "#f6d0d0";
    const accent = "#e58f8f";

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let raf = 0;
    let running = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const seed = () => {
      const target = Math.min(
        Math.floor((width * height) * PARTICLE_COUNT_BY_AREA),
        110,
      );
      particles = Array.from({ length: Math.max(target, 24) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.6 + 0.7,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // move + draw nodes
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // wrap around edges so the field never empties out
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = secondary;
        ctx.globalAlpha = 0.55;
        ctx.fill();
      }

      // draw connections — O(n²) is fine at n<=110
      ctx.globalAlpha = 1;
      ctx.lineWidth = 0.7;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > CONNECTION_DISTANCE) continue;

          const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.4;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = alpha > 0.22 ? primary : accent;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      if (running) raf = requestAnimationFrame(draw);
    };

    resize();

    // Freeze while off-screen or when the tab is hidden.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && document.visibilityState === "visible") {
          if (!running) {
            running = true;
            raf = requestAnimationFrame(draw);
          }
        } else if (running) {
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
        raf = requestAnimationFrame(draw);
      }
    };

    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    draw();

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
      data-testid="neural-background"
      className={className}
    />
  );
}
