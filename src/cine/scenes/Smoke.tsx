import { useEffect, useRef, useState } from 'react';
import { drawSmoke, prepareSmoke, smokeReady, type SmokePart } from '../art/smokeEngine';
import { useCanvas } from './useCanvas';

interface SmokeProps {
  part: SmokePart;
  mobile: boolean;
}

/**
 * One of two smoke planes. The back plane sits under the name, the front plane
 * over it, so the letters are genuinely veiled by the atmosphere rather than
 * merely faded by CSS.
 */
export default function Smoke({ part, mobile }: SmokeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(() => smokeReady(mobile));
  const redraw = useCanvas(canvasRef, 1, (ctx, width, height, frame, scale) => {
    if (!smokeReady(mobile)) return;
    drawSmoke(ctx, width, height, frame, part, mobile, scale);
  });

  useEffect(() => {
    let cancelled = false;
    if (!smokeReady(mobile)) {
      void prepareSmoke(mobile).then(() => {
        if (cancelled) return;
        setReady(true);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [mobile]);

  useEffect(() => {
    if (ready) redraw();
  }, [ready, redraw]);

  return (
    <canvas ref={canvasRef} className={`smoke smoke-${part}`} aria-hidden="true" role="presentation" />
  );
}
