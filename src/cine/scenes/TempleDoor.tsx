import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFilm } from '../film';
import { device, quality } from '../../perf';
import { choosePlateWidth } from '../../load/assets';

/**
 * The threshold: the watercolour elevation of the door, arriving out of the
 * settling smoke once the names have dissolved.
 *
 * This is the last beat of the film and the first surface of the corridor. The
 * plate's own paper becomes the white the hall opens on, so the handover needs
 * no cut and no separate cover. Only opacity and one transform are written per
 * frame.
 */
export default function TempleDoor() {
  const film = useFilm();
  const rootRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // Match the boot plate width, so a phone never pulls the 2000px file.
  const plateWidth = choosePlateWidth(
    typeof window === 'undefined' ? 1280 : window.innerWidth,
    device.dpr,
    quality.dprCap,
    quality.plateWidth,
  );
  const srcSet =
    plateWidth === 2000
      ? `${import.meta.env.BASE_URL}world/temple-door-1280.webp 1280w, ${import.meta.env.BASE_URL}world/temple-door-2000.webp 2000w`
      : `${import.meta.env.BASE_URL}world/temple-door-1280.webp 1280w`;

  // A plate revealed by scroll must be decoded before it is shown: a
  // half-painted image would read as a hard block over the white.
  useEffect(() => {
    const root = rootRef.current;
    const img = imgRef.current;
    if (!root || !img) return;
    let alive = true;
    const decoded = img.decode ? img.decode().catch(() => undefined) : Promise.resolve();
    void decoded.then(() => {
      if (alive) root.classList.add('is-ready');
    });
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(
    () =>
      film.subscribe((frame) => {
        const node = rootRef.current;
        if (!node) return;
        node.style.opacity = frame.temple.opacity.toFixed(4);
        node.style.transform = `translate3d(0, ${frame.temple.rise.toFixed(2)}px, 0) scale(${frame.temple.scale.toFixed(4)})`;
      }),
    [film],
  );

  return (
    <div className="temple-door" ref={rootRef} aria-hidden="true">
      <picture className="temple-door__picture">
        <source type="image/webp" srcSet={srcSet} sizes="100vw" />
        <img
          className="temple-door__plate"
          ref={imgRef}
          src={`${import.meta.env.BASE_URL}world/temple-door.jpg`}
          alt=""
          width={2000}
          height={1125}
          decoding="async"
        />
      </picture>
    </div>
  );
}
