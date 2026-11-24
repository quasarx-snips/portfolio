import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import type { Frame } from '../frame';
import { useFilm } from '../film';
import { quality } from '../../perf';

export type CanvasDraw = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: Frame,
  scale: number,
) => void;

/**
 * Shared canvas plumbing: backing-store sizing, resize observation and a
 * scroll-frame subscription. Draws are coalesced onto the GSAP ticker's frame,
 * never on a private timer.
 */
export function useCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  resolution: number | 'dpr',
  draw: CanvasDraw,
): () => void {
  const film = useFilm();
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const redrawRef = useRef<() => void>(() => undefined);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    let width = 0;
    let height = 0;
    let scale = 1;

    const paint = () => {
      if (width <= 0 || height <= 0) return;
      drawRef.current(context, width, height, film.frame, scale);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const dpr =
        typeof resolution === 'number'
          ? resolution
          : Math.min(window.devicePixelRatio || 1, quality.dprCap);
      scale = dpr;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    };

    redrawRef.current = paint;
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const unsubscribe = film.subscribe(paint);

    return () => {
      observer.disconnect();
      unsubscribe();
      redrawRef.current = () => undefined;
    };
  }, [canvasRef, film, resolution]);

  return useCallback(() => redrawRef.current(), []);
}
