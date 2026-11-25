import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFilm } from '../film';
import { device, quality } from '../../perf';
import { choosePlateWidth } from '../../load/assets';

/**
 * The two leaves in plate coordinates, measured off the elevation to the
 * millimetre of paint: the leaves themselves, inside the carved casing, lintel
 * to sill. The warmth is the door's shape, not a glow around it.
 */
const DOOR = { left: 0.4526, right: 0.5463, top: 0.5209, bottom: 0.7787 } as const;

/**
 * The threshold: the watercolour elevation of the door, arriving out of the
 * settling smoke once the names have dissolved.
 *
 * This is the last beat of the film and the first surface of the corridor. The
 * plate's own paper becomes the white the hall opens on, so the handover needs
 * no cut and no separate cover. Only opacity and one transform are written per
 * frame.
 *
 * Two things live on top of the paint: a slow mist at the foot of the steps,
 * and the door darkening to wood when the pointer comes near. The wood is a
 * second copy of the same plate, cropped to the leaves and raised in contrast,
 * so it keeps the painting's own crispness instead of washing a tint over it.
 * It does not fade in: it spills, opening from where the hand came in and
 * running across the leaves, and drains back the same way.
 */
export default function TempleDoor() {
  const film = useFilm();
  const rootRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const warmRef = useRef<HTMLDivElement>(null);
  const woodRef = useRef<HTMLImageElement>(null);
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
  const fallback = `${import.meta.env.BASE_URL}world/temple-door.jpg`;

  // A plate revealed by scroll must be decoded before it is shown: a
  // half-painted image would read as a hard block over the white.
  useEffect(() => {
    const root = rootRef.current;
    const img = imgRef.current;
    const wood = woodRef.current;
    if (!root || !img) return;
    let alive = true;
    // Both copies are decoded before the reveal: the wood is the same bytes, so
    // it is only a second decode, and it means the first hover cannot flash the
    // pale leaves before the timber arrives.
    const decode = (node: HTMLImageElement | null) =>
      node?.decode ? node.decode().catch(() => undefined) : Promise.resolve();
    void Promise.all([decode(img), decode(wood)]).then(() => {
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

  // The leaves' box, and the warmth inside it.
  useEffect(() => {
    const root = rootRef.current;
    const img = imgRef.current;
    const warm = warmRef.current;
    const wood = woodRef.current;
    if (!root || !img || !warm || !wood) return;

    const wide = window.matchMedia('(min-aspect-ratio: 2/1)');

    /** The plate's painted box inside its element, under either object-fit. */
    const plateBox = () => {
      const box = img.getBoundingClientRect();
      const nw = img.naturalWidth || 2000;
      const nh = img.naturalHeight || 1125;
      const scale = wide.matches
        ? Math.min(box.width / nw, box.height / nh)
        : Math.max(box.width / nw, box.height / nh);
      const shownW = nw * scale;
      const shownH = nh * scale;
      return {
        offsetX: (box.width - shownW) * 0.5,
        offsetY: (box.height - shownH) * 0.48,
        width: shownW,
        height: shownH,
        viewportX: box.left + (box.width - shownW) * 0.5,
        viewportY: box.top + (box.height - shownH) * 0.48,
        boxW: box.width,
        boxH: box.height,
      };
    };

    // Everything is expressed as a percentage of the box it lives in, so the
    // plate's per-frame scale never has to be followed by hand.
    const place = () => {
      const plate = plateBox();
      if (!plate.boxW || !plate.boxH) return;
      const doorW = (DOOR.right - DOOR.left) * plate.width;
      const doorH = (DOOR.bottom - DOOR.top) * plate.height;
      const doorX = plate.offsetX + DOOR.left * plate.width;
      const doorY = plate.offsetY + DOOR.top * plate.height;
      warm.style.left = `${(doorX / plate.boxW) * 100}%`;
      warm.style.top = `${(doorY / plate.boxH) * 100}%`;
      warm.style.width = `${(doorW / plate.boxW) * 100}%`;
      warm.style.height = `${(doorH / plate.boxH) * 100}%`;
      // The second copy is the whole plate, shifted so the leaves land on the
      // leaves; the crop is the box's own overflow.
      wood.style.width = `${(plate.boxW / doorW) * 100}%`;
      wood.style.height = `${(plate.boxH / doorH) * 100}%`;
      wood.style.left = `${(-doorX / doorW) * 100}%`;
      wood.style.top = `${(-doorY / doorH) * 100}%`;
    };

    place();
    window.addEventListener('resize', place);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(root);

    const still = window.matchMedia('(prefers-reduced-motion: reduce)');

    let target = 0;
    let spill = 0;
    let frame = 0;
    let last = 0;

    const write = () => {
      // Opaque as soon as any of it has spilled: the mask alone decides where
      // the wood has reached, so the leaves are never half-painted putty.
      root.style.setProperty('--warm', Math.min(1, spill * 14).toFixed(3));
      root.style.setProperty('--spill', spill.toFixed(3));
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = last ? Math.min(0.064, (now - last) / 1000) : 0.016;
      last = now;
      // Out slower than in, so the leaves drain rather than snap back, and
      // eased by the clock so a 144Hz screen spills no faster than a 60.
      const tau = target > spill ? 0.13 : 0.19;
      spill += (target - spill) * (1 - Math.exp(-dt / tau));
      // The last of it is a fleck of shadow; drop it rather than let the
      // leaves fade out through a brown haze.
      if (Math.abs(target - spill) < 0.002 || (target === 0 && spill < 0.06)) spill = target;
      write();
      if (spill !== target) frame = requestAnimationFrame(tick);
    };

    const aim = () => {
      if (frame) return;
      if (still.matches) {
        spill = target;
        write();
        return;
      }
      // A run that starts after a pause must not inherit the last frame's
      // timestamp, or its first step would be a jump.
      last = 0;
      frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      // A resize the observer missed would leave the box stale; while the
      // warmth is off, re-measure on the way in. It costs two rect reads.
      if (spill === 0) place();
      const plate = plateBox();
      const left = plate.viewportX + DOOR.left * plate.width;
      const top = plate.viewportY + DOOR.top * plate.height;
      const width = (DOOR.right - DOOR.left) * plate.width;
      const height = (DOOR.bottom - DOOR.top) * plate.height;
      if (!(width > 0) || !(height > 0)) return;
      const dx = Math.max(0, Math.abs(event.clientX - (left + width / 2)) - width / 2);
      const dy = Math.max(0, Math.abs(event.clientY - (top + height / 2)) - height / 2);
      // The warmth carries a little past the jambs, then falls away.
      const reach = Math.max(56, Math.min(width, height) * 0.55);
      const near = Math.max(0, 1 - Math.hypot(dx, dy) / reach);
      target = near * near * (3 - 2 * near);
      // The spill opens from where the hand came in. Once it is running the
      // seed is left alone, or the wood would slide about under the pointer.
      if (spill < 0.05) {
        const seedX = Math.min(Math.max(event.clientX, left), left + width);
        const seedY = Math.min(Math.max(event.clientY, top), top + height);
        root.style.setProperty('--seed-x', `${(((seedX - left) / width) * 100).toFixed(1)}%`);
        root.style.setProperty('--seed-y', `${(((seedY - top) / height) * 100).toFixed(1)}%`);
      }
      aim();
    };

    const onLeave = (event: PointerEvent) => {
      if (event.relatedTarget) return;
      target = 0;
      aim();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerout', onLeave, { passive: true });

    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onLeave);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      root.style.removeProperty('--warm');
      root.style.removeProperty('--spill');
      root.style.removeProperty('--seed-x');
      root.style.removeProperty('--seed-y');
    };
  }, []);

  return (
    <div className="temple-door" ref={rootRef} aria-hidden="true">
      <picture className="temple-door__picture">
        <source type="image/webp" srcSet={srcSet} sizes="100vw" />
        <img
          className="temple-door__plate"
          ref={imgRef}
          src={fallback}
          alt=""
          width={2000}
          height={1125}
          decoding="async"
        />
      </picture>
      <div className="temple-door__warm" ref={warmRef}>
        <img
          className="temple-door__wood"
          ref={woodRef}
          srcSet={srcSet}
          sizes="100vw"
          src={fallback}
          alt=""
          width={2000}
          height={1125}
          decoding="async"
        />
      </div>
      <div className="temple-door__fog">
        <span className="temple-door__fog-a" />
        <span className="temple-door__fog-b" />
        <span className="temple-door__fog-c" />
      </div>
    </div>
  );
}
