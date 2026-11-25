import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import CorridorHud from './CorridorHud';
import RoomView from './Room';
import { corridorProgress, isNear, readCorridor, roomPose } from './geometry';
import { KIND_LABEL, ROOMS, roomIndex } from './rooms';
import '../styles/corridor.css';

const COUNT = ROOMS.length;

/** A deep link (`?room=…` or `#room-…`) is honoured on first paint. */
function readRequestedRoom(): string | null {
  if (typeof window === 'undefined') return null;
  const fromQuery = new URLSearchParams(window.location.search).get('room');
  if (fromQuery) return fromQuery;
  return window.location.hash.startsWith('#room-') ? window.location.hash.slice(6) : null;
}

/**
 * The corridor.
 *
 * One section, one sticky stage, one scroll owner. The section's height is the
 * only thing that grows with the number of rooms. The hall inside the stage is
 * fixed; rooms are painted from scroll position alone, so the choreography is
 * reversible and React stays out of the frame loop — the component re-renders
 * only when the active room changes.
 */
export default function Corridor() {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const seamRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  const nodes = useRef<(HTMLElement | null)[]>([]);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  const registers = useMemo(
    () =>
      ROOMS.map((_, index) => (node: HTMLElement | null) => {
        nodes.current[index] = node;
      }),
    [],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;

    const request = readRequestedRoom();
    const fromFilm = request === null;
    const initial = request ? (Number.isFinite(Number(request)) ? Number(request) : roomIndex(request)) : -1;

    const geometry = { top: 0, bay: 0 };
    let queued = false;
    let alive = true;
    let lastCheck = 0;

    const measure = () => {
      const bay = stage.clientHeight;
      if (!bay || !alive) return;
      geometry.bay = bay;
      geometry.top = root.getBoundingClientRect().top + window.scrollY;
      root.style.height = `${COUNT * bay}px`;
    };

    const paint = () => {
      queued = false;
      const { top, bay } = geometry;
      if (!bay) return;

      // The field film above is pinned and re-measured by GSAP; re-read our
      // offset occasionally instead of trusting a stale measurement.
      const now = performance.now();
      if (now - lastCheck > 400) {
        lastCheck = now;
        const live = root.getBoundingClientRect().top + window.scrollY;
        if (Math.abs(live - top) > 1) geometry.top = live;
      }

      const scrollTop = window.scrollY - geometry.top;
      const frame = readCorridor(scrollTop, bay, COUNT);

      for (let index = 0; index < COUNT; index += 1) {
        const node = nodes.current[index];
        if (!node) continue;
        const pose = roomPose(index, frame.depth);
        if (!isNear(pose.rel)) {
          node.style.opacity = '0';
          node.style.transform = `translate3d(0, ${pose.rel > 0 ? 60 : -60}px, 0)`;
          continue;
        }
        node.style.transform = `translate3d(0, ${pose.drift.toFixed(2)}px, 0)`;
        node.style.opacity = pose.opacity.toFixed(3);
      }

      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${corridorProgress(frame.depth, COUNT).toFixed(4)})`;
      }
      // The seam belongs to the hand-off from the film's white; a deep link
      // lands inside the hall and has no white to clear.
      if (seamRef.current && fromFilm) {
        seamRef.current.style.opacity = Math.max(0, 1 - frame.depth / 0.62).toFixed(3);
      }

      // The counter follows the room that owns the screen: the crossfade is
      // centred on the half-bay, so rounding is the honest reading.
      const shown = Math.min(COUNT - 1, Math.round(frame.depth));
      if (shown !== activeRef.current) {
        activeRef.current = shown;
        setActive(shown);
      }
    };

    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    };

    const jumpTo = (target: number | string) => {
      const index = typeof target === 'number' ? target : roomIndex(target);
      if (!Number.isFinite(index) || index < 0) return;
      const clamped = Math.min(COUNT - 1, Math.max(0, index));
      window.scrollTo({ top: geometry.top + geometry.bay * clamped, behavior: 'auto' });
      schedule();
    };

    measure();
    paint();
    if (seamRef.current && fromFilm) seamRef.current.style.opacity = '1';

    if (initial >= 0) {
      // Layout above us (the pinned film, late fonts) settles a beat later.
      window.setTimeout(() => {
        measure();
        jumpTo(initial);
      }, 80);
    }

    window.addEventListener('scroll', schedule, { passive: true });

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const index = activeRef.current;
        measure();
        jumpTo(index);
      }, 150);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    const onHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#room-')) jumpTo(hash.slice(6));
    };
    window.addEventListener('hashchange', onHash);

    void document.fonts?.ready.then(() => {
      if (!alive) return;
      measure();
      schedule();
    });

    if (import.meta.env.DEV) {
      window.__palace = {
        ...(window.__palace ?? {}),
        walk: (target: number | string) => jumpTo(target),
        room: () => activeRef.current,
        rooms: () => ROOMS.map((room) => room.id),
      };
    }

    return () => {
      alive = false;
      window.clearTimeout(resizeTimer);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  useEffect(() => {
    const room = ROOMS[active];
    if (!room) return;
    const timer = window.setTimeout(() => {
      setAnnouncement(`Room ${active + 1} of ${COUNT} — ${room.title}, ${KIND_LABEL[room.kind]}.`);
    }, 420);
    return () => window.clearTimeout(timer);
  }, [active]);

  return (
    <section
      className="corridor"
      ref={rootRef}
      id="corridor"
      aria-label="The rooms of the Palace"
      style={{ '--rooms': COUNT } as CSSProperties}
    >
      <div className="corridor__stage" ref={stageRef}>
        <h2 className="sr-only">The rooms of the Palace</h2>

        <div className="corridor__hall" aria-hidden="true">
          <div className="hall__arch hall__arch--far" />
          <div className="hall__arch" />
          <div className="hall__door" />
          <div className="hall__col hall__col--a" />
          <div className="hall__col hall__col--b" />
          <div className="hall__col hall__col--c" />
          <div className="hall__col hall__col--d" />
          <div className="hall__floor" />
          <div className="hall__plinth" />
        </div>

        <div className="corridor__seam" ref={seamRef} aria-hidden="true" />
        <div className="corridor__vignette" aria-hidden="true" />

        {ROOMS.map((room, index) => (
          <RoomView
            key={room.id}
            room={room}
            index={index}
            active={index === active}
            register={registers[index]}
          />
        ))}

        <CorridorHud index={active} total={COUNT} kind={ROOMS[active]?.kind ?? 'project'} barRef={barRef} />

        <p className="corridor__live" aria-live="polite">
          {announcement}
        </p>
      </div>
    </section>
  );
}