import { useLayoutEffect, useRef } from 'react';
import { drawDust, getGrainUrl } from '../art/dustEngine';
import { useFilm } from '../film';
import { useCanvas } from './useCanvas';
import { quality } from '../../perf';

/**
 * Everything that is atmosphere rather than architecture: dust, grain,
 * vignette and the first almost-nothing glow of the dark screen.
 */
export default function Atmosphere({ mobile }: { mobile: boolean }) {
  const film = useFilm();
  const dustRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const primordialRef = useRef<HTMLDivElement>(null);

  useCanvas(dustRef, 'dpr', (ctx, width, height, frame, scale) => {
    drawDust(ctx, width, height, frame, mobile, scale, quality.particleScale);
  });

  useLayoutEffect(
    () =>
      film.subscribe((frame) => {
        if (grainRef.current) {
          grainRef.current.style.opacity = frame.grain.toFixed(3);
          grainRef.current.style.backgroundPosition = `${(frame.p * 193).toFixed(1)}px ${(frame.p * 137).toFixed(1)}px`;
        }
        if (vignetteRef.current) vignetteRef.current.style.opacity = frame.vignette.toFixed(3);
        if (primordialRef.current) primordialRef.current.style.opacity = frame.primordial.toFixed(3);
      }),
    [film],
  );

  return (
    <>
      <div className="primordial" ref={primordialRef} aria-hidden="true" />
      <canvas ref={dustRef} className="dust-canvas" aria-hidden="true" role="presentation" />
      {quality.grain ? (
        <div
          className="grain"
          ref={grainRef}
          aria-hidden="true"
          style={{ backgroundImage: `url(${getGrainUrl()})` }}
        />
      ) : null}
      <div className="vignette" ref={vignetteRef} aria-hidden="true" />
    </>
  );
}
