import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFilm } from '../film';
import { device, quality } from '../../perf';
import { choosePlateWidth } from '../../load/assets';

const CLEAR_START = 0.44;
const CLEAR_END = 0.58;

function smoothstep(value: number, edge0: number, edge1: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The temple world, built from the two supplied plates.
 *
 * The dark, misty plate holds the opening. As the identity arrives, a soft
 * radial mask opens around the temple and the clear plate is revealed through
 * it, so the water and stone resolve out of the mist rather than cross-fading
 * flatly.
 */
export default function World({ variant }: { variant: 'wide' | 'tall' }) {
  const film = useFilm();
  const rootRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const clearRef = useRef<HTMLImageElement>(null);
  const darkRef = useRef<HTMLImageElement>(null);
  const warmRef = useRef<HTMLDivElement>(null);
  // Match the variant the boot preload picked, so the plate is a cache hit
  // instead of a second download. The tier caps the width; the browser's own
  // DPR decides the rest.
  const plateWidth = choosePlateWidth(
    typeof window === 'undefined' ? 1280 : window.innerWidth,
    device.dpr,
    quality.dprCap,
    quality.plateWidth,
  );
  const darkSrcSet =
    plateWidth === 2000
      ? `${import.meta.env.BASE_URL}world/temple-dark-1280.webp 1280w, ${import.meta.env.BASE_URL}world/temple-dark-2000.webp 2000w`
      : `${import.meta.env.BASE_URL}world/temple-dark-1280.webp 1280w`;
  const clearSrcSet =
    plateWidth === 2000
      ? `${import.meta.env.BASE_URL}world/temple-clear-1280.webp 1280w, ${import.meta.env.BASE_URL}world/temple-clear-2000.webp 2000w`
      : `${import.meta.env.BASE_URL}world/temple-clear-1280.webp 1280w`;

  // The plates are the largest paint on the page. Decode both before the world
  // is shown, so a slow device never reveals a half-painted frame (which reads
  // as a hard-edged black block while the JPEG is still decoding).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let alive = true;
    const plates = [darkRef.current, clearRef.current].filter(
      (img): img is HTMLImageElement => Boolean(img),
    );
    const ready = plates.map((img) =>
      img.decode ? img.decode().catch(() => undefined) : Promise.resolve(undefined),
    );
    void Promise.all(ready).then(() => {
      if (alive) root.classList.add('is-ready');
    });
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(
    () =>
      film.subscribe((frame) => {
        const clear = smoothstep(frame.p, CLEAR_START, CLEAR_END);
        const push = smoothstep(frame.p, 0.0, 0.8);
        const drift = smoothstep(frame.p, 0.0, 0.64);
        const warm =
          smoothstep(frame.p, 0.16, 0.48) * (1 - smoothstep(frame.p, 0.68, 0.8));

        if (rootRef.current) {
          rootRef.current.style.opacity = (1 - smoothstep(frame.p, 0.8, 0.92)).toFixed(3);
        }
        if (clearRef.current) {
          clearRef.current.style.opacity = Math.min(1, clear * 3).toFixed(3);
          clearRef.current.style.setProperty('--clear', clear.toFixed(4));
        }
        if (layersRef.current) {
          // A slow, near-imperceptible push-in across the whole opening, with
          // the clear plate easing a little further forward than the dark one.
          const zoom = 1.03 + 0.065 * push + 0.018 * clear - 0.008 * frame.env.haze;
          const rise = -3.5 * drift;
          layersRef.current.style.transform = `translate3d(0, ${rise.toFixed(2)}px, 0) scale(${zoom.toFixed(4)})`;
        }
        if (warmRef.current) {
          // Dawn light gathers over the water, then hands over to the smoke.
          warmRef.current.style.opacity = (0.12 + 0.22 * warm).toFixed(3);
        }
      }),
    [film],
  );

  return (
    <div className={`world world--${variant}`} ref={rootRef} aria-hidden="true">
      <div className="world__layers" ref={layersRef}>
        <picture className="world__picture">
          <source
            type="image/webp"
            srcSet={darkSrcSet}
            sizes="100vw"
          />
          <img
            className="world__layer"
            ref={darkRef}
            src={`${import.meta.env.BASE_URL}world/temple-dark.jpg`}
            alt=""
            width={2000}
            height={1125}
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <picture className="world__picture">
          <source
            type="image/webp"
            srcSet={clearSrcSet}
            sizes="100vw"
          />
          <img
            className="world__layer world__clear"
            ref={clearRef}
            src={`${import.meta.env.BASE_URL}world/temple-clear.jpg`}
            alt=""
            width={2000}
            height={1125}
            decoding="async"
          />
        </picture>
      </div>
      <div
        className="world__warm"
        ref={warmRef}
        style={{ mixBlendMode: quality.warmBlend }}
      />
      <div className="world__vignette" />
    </div>
  );
}
