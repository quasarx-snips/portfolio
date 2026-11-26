import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useFilm } from '../film';
import { device, quality } from '../../perf';
import { choosePlateWidth } from '../../load/assets';

/**
 * The two leaves in plate coordinates, measured off the elevation to the
 * millimetre of paint: the leaves themselves, inside the carved casing, lintel
 * to sill. The warmth is the door's shape, not a glow around it, and the seam
 * the leaves hinge on is the join between them.
 */
const DOOR = { left: 0.4526, right: 0.5463, top: 0.5209, bottom: 0.7787 } as const;

/** How far each leaf swings inward, and how long the swing takes. */
const SWING = 76;
const SWING_SECONDS = 1.5;

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
 *
 * The door then opens. Clicking it drops two hinged copies of the same paint
 * over the leaves, swings them inward on their outer edges and lets the dark
 * behind them out. The plate is flat, so the movement has to come from the
 * leaves themselves: each carries the whole painting inside it, offset so that
 * half of it shows, and clips the rest. The doorway is measured from the same
 * rect as the warmth, so they can never part where the paint does not.
 */
export default function TempleDoor() {
  const film = useFilm();
  const rootRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const warmRef = useRef<HTMLDivElement>(null);
  const woodRef = useRef<HTMLImageElement>(null);
  const leavesRef = useRef<HTMLDivElement>(null);
  const leafLeftRef = useRef<HTMLDivElement>(null);
  const leafRightRef = useRef<HTMLDivElement>(null);
  const insideRef = useRef<HTMLDivElement>(null);
  const depthRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const leakRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  /** Drop the warmth's seed at a point, for a hand that has no hover to give it. */
  const seedRef = useRef<(x: number, y: number) => void>(() => undefined);
  const shadeRefs = useRef<Array<HTMLDivElement | null>>([]);
  const knockRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const liveRef = useRef(false);
  const swingRef = useRef<gsap.core.Timeline | null>(null);
  const pinRef = useRef<(next: boolean) => void>(() => undefined);

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
    if (!root || !img) return;
    let alive = true;
    // Every copy is decoded before the reveal: the leaves are the same bytes,
    // and it means the first hover or the first click cannot flash them pale.
    const decode = (node: HTMLImageElement | null) =>
      node?.decode ? node.decode().catch(() => undefined) : Promise.resolve();
    const copies = Array.from(root.querySelectorAll<HTMLImageElement>('.temple-door__leaf img'));
    void Promise.all([decode(img), ...copies.map((node) => decode(node))]).then(() => {
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
        // The door is only a control once the plate is actually on screen.
        const live = frame.temple.opacity > 0.6;
        if (live !== liveRef.current) {
          liveRef.current = live;
          node.classList.toggle('is-live', live);
        }
      }),
    [film],
  );

  // The leaves' box, the doorway inside it, and the warmth inside that.
  useEffect(() => {
    const root = rootRef.current;
    const img = imgRef.current;
    const warm = warmRef.current;
    const wood = woodRef.current;
    const leaves = leavesRef.current;
    const leafLeft = leafLeftRef.current;
    const leafRight = leafRightRef.current;
    const inside = insideRef.current;
    const leak = leakRef.current;
    const bloom = bloomRef.current;
    const knock = knockRef.current;
    if (
      !root ||
      !img ||
      !warm ||
      !wood ||
      !leaves ||
      !leafLeft ||
      !leafRight ||
      !inside ||
      !leak ||
      !bloom ||
      !knock
    ) {
      return;
    }

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
      const door = {
        left: `${(doorX / plate.boxW) * 100}%`,
        top: `${(doorY / plate.boxH) * 100}%`,
        width: `${(doorW / plate.boxW) * 100}%`,
        height: `${(doorH / plate.boxH) * 100}%`,
      };
      const rect = (node: HTMLElement) => {
        node.style.left = door.left;
        node.style.top = door.top;
        node.style.width = door.width;
        node.style.height = door.height;
      };
      // The second copy is the whole plate, shifted so the leaves land on the
      // leaves; the crop is the box's own overflow.
      const placeWarm = (node: HTMLElement) => {
        rect(node);
        const timber = node.querySelector<HTMLElement>('.temple-door__wood');
        if (!timber) return;
        timber.style.width = `${(plate.boxW / doorW) * 100}%`;
        timber.style.height = `${(plate.boxH / doorH) * 100}%`;
        timber.style.left = `${(-doorX / doorW) * 100}%`;
        timber.style.top = `${(-doorY / doorH) * 100}%`;
      };

      placeWarm(warm);
      rect(inside);
      rect(knock);
      // The lamp's wash on the steps: wider than the doorway and starting at
      // the sill, so it reads as light coming out rather than a stain.
      const leakW = doorW * 1.6;
      const leakH = doorH * 0.4;
      leak.style.left = `${((doorX + doorW / 2 - leakW / 2) / plate.boxW) * 100}%`;
      leak.style.top = `${((doorY + doorH - 2) / plate.boxH) * 100}%`;
      leak.style.width = `${(leakW / plate.boxW) * 100}%`;
      leak.style.height = `${(leakH / plate.boxH) * 100}%`;
      // The bloom is the same doorway, opened out wide: it is what the light
      // does to the air and the casing around the frame, not to the frame.
      const bloomW = doorW * 2.2;
      const bloomH = doorH * 1.7;
      bloom.style.left = `${((doorX + doorW / 2 - bloomW / 2) / plate.boxW) * 100}%`;
      bloom.style.top = `${((doorY + doorH / 2 - bloomH / 2) / plate.boxH) * 100}%`;
      bloom.style.width = `${(bloomW / plate.boxW) * 100}%`;
      bloom.style.height = `${(bloomH / plate.boxH) * 100}%`;
      // The leaves are the door's two halves. Each carries the whole plate
      // inside it, offset so that half of the painting shows, and clips the
      // rest: that is what lets the same paint hinge without re-cutting it.
      const halfW = doorW * 0.5;
      const halves = [
        { leaf: leafLeft, x: doorX, shift: -doorX },
        { leaf: leafRight, x: doorX + halfW, shift: -(doorX + halfW) },
      ];
      for (const { leaf, x, shift } of halves) {
        leaf.style.left = `${(x / plate.boxW) * 100}%`;
        leaf.style.top = door.top;
        leaf.style.width = `${(halfW / plate.boxW) * 100}%`;
        leaf.style.height = door.height;
        const crop = leaf.querySelector<HTMLElement>('.temple-door__half');
        if (crop) {
          crop.style.width = `${(plate.boxW / halfW) * 100}%`;
          crop.style.height = `${(plate.boxH / doorH) * 100}%`;
          crop.style.left = `${(shift / halfW) * 100}%`;
          crop.style.top = `${(-doorY / doorH) * 100}%`;
        }
        leaf.querySelectorAll<HTMLElement>('.temple-door__warm').forEach(placeWarm);
      }
    };

    place();
    window.addEventListener('resize', place);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(root);

    const still = window.matchMedia('(prefers-reduced-motion: reduce)');

    let target = 0;
    let hover = 0;
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

    // An open door is wood whatever the pointer does: the leaves must not drain
    // back to paint while they are swung away from the doorway.
    pinRef.current = (next: boolean) => {
      target = next ? 1 : hover;
      aim();
    };

    // A thumb has no hover: the warmth has to start where it lands.
    seedRef.current = (clientX: number, clientY: number) => {
      const plate = plateBox();
      const left = plate.viewportX + DOOR.left * plate.width;
      const top = plate.viewportY + DOOR.top * plate.height;
      const width = (DOOR.right - DOOR.left) * plate.width;
      const height = (DOOR.bottom - DOOR.top) * plate.height;
      if (!(width > 0) || !(height > 0)) return;
      const seedX = Math.min(Math.max(clientX, left), left + width);
      const seedY = Math.min(Math.max(clientY, top), top + height);
      root.style.setProperty('--seed-x', `${(((seedX - left) / width) * 100).toFixed(1)}%`);
      root.style.setProperty('--seed-y', `${(((seedY - top) / height) * 100).toFixed(1)}%`);
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
      hover = near * near * (3 - 2 * near);
      target = openRef.current ? 1 : hover;
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
      hover = 0;
      target = openRef.current ? 1 : 0;
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
      pinRef.current = () => undefined;
      seedRef.current = () => undefined;
      root.style.removeProperty('--warm');
      root.style.removeProperty('--spill');
      root.style.removeProperty('--seed-x');
      root.style.removeProperty('--seed-y');
    };
  }, []);

  // The swing: both leaves turn on their outer edges, the dark behind them
  // comes up, and the light at the sill with it. One timeline, played and
  // reversed, so closing is the same movement run backwards.
  useEffect(() => {
    const left = leafLeftRef.current;
    const right = leafRightRef.current;
    const inside = insideRef.current;
    const depth = depthRef.current;
    const glow = glowRef.current;
    const leak = leakRef.current;
    const bloom = bloomRef.current;
    if (!left || !right || !inside || !depth || !glow || !leak || !bloom) return;
    const shades = shadeRefs.current.filter((node): node is HTMLDivElement => Boolean(node));
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.inOut' } });
    tl
      // The leaves are pushed by two hands, not one: the second follows the
      // first by a breath.
      .to(left, { rotateY: SWING, duration: SWING_SECONDS, ease: 'power2.inOut' }, 0)
      .to(right, { rotateY: -SWING, duration: SWING_SECONDS, ease: 'power2.inOut' }, 0.05)
      // The dark behind them is there from the first frame: it is what the
      // leaves uncover, not a picture that fades up under them.
      .to(inside, { opacity: 1, duration: 0.18, ease: 'none' }, 0)
      .to(depth, { scale: 1, duration: 1.1, ease: 'power2.out' }, 0)
      .to(glow, { opacity: 1, duration: 0.8, ease: 'power1.out' }, 0.16)
      .to(leak, { opacity: 1, duration: 0.9, ease: 'power1.out' }, 0.2)
      .to(bloom, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.05)
      .to(bloom, { opacity: 0.55, duration: 1.2, ease: 'power1.out' }, 0.6)
      .to(shades, { opacity: 0.42, duration: SWING_SECONDS * 0.8 }, 0);
    swingRef.current = tl;
    return () => {
      tl.kill();
      swingRef.current = null;
    };
  }, []);

  useEffect(() => {
    openRef.current = open;
    const tl = swingRef.current;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (tl) {
      if (still.matches) tl.progress(open ? 1 : 0);
      else if (open) tl.play();
      else tl.reverse();
    }
    pinRef.current(open);
  }, [open]);

  const toggle = useCallback(() => setOpen((was) => !was), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // The leaves, drawn twice: the half of the plate each one carries, and the
  // boards on its back for the moment the swing shows them.
  const leaf = (side: 'left' | 'right') => (
    <div
      className={'temple-door__leaf temple-door__leaf--' + side}
      ref={side === 'left' ? leafLeftRef : leafRightRef}
      aria-hidden="true"
    >
      <div className="temple-door__face">
        <div className="temple-door__half">
          <picture className="temple-door__picture">
            <source type="image/webp" srcSet={srcSet} sizes="100vw" />
            <img
              className="temple-door__plate"
              src={fallback}
              alt=""
              width={2000}
              height={1125}
              decoding="async"
            />
          </picture>
          <div className="temple-door__warm">
            <img
              className="temple-door__wood"
              srcSet={srcSet}
              sizes="100vw"
              src={fallback}
              alt=""
              width={2000}
              height={1125}
              decoding="async"
            />
          </div>
        </div>
        <div
          className="temple-door__shade"
          ref={(node) => {
            shadeRefs.current[side === 'left' ? 0 : 1] = node;
          }}
        />
      </div>
      <div className="temple-door__back" />
    </div>
  );

  return (
    <div className="temple-door" ref={rootRef}>
      <picture className="temple-door__picture" aria-hidden="true">
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
      <div className="temple-door__warm" ref={warmRef} aria-hidden="true">
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
      <div className="temple-door__inside" ref={insideRef} aria-hidden="true">
        <div className="temple-door__depth" ref={depthRef}>
          <div className="temple-door__glow" ref={glowRef} />
          <div className="temple-door__motes">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
      <div className="temple-door__bloom" ref={bloomRef} aria-hidden="true" />
      <div className="temple-door__leak" ref={leakRef} aria-hidden="true" />
      <div className="temple-door__leaves" ref={leavesRef}>
        {leaf('left')}
        {leaf('right')}
      </div>
      <div className="temple-door__fog" aria-hidden="true">
        <span className="temple-door__fog-a" />
        <span className="temple-door__fog-b" />
        <span className="temple-door__fog-c" />
      </div>
      <button
        type="button"
        className="temple-door__knock"
        ref={knockRef}
        onClick={toggle}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse' && !openRef.current) {
            seedRef.current(event.clientX, event.clientY);
          }
        }}
        aria-pressed={open}
        aria-label={open ? 'Close the door' : 'Open the door'}
      />
    </div>
  );
}
