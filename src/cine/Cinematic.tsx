import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Film, FilmContext } from './film';
import { smoothstep } from './easing';
import { useViewMode } from './useViewMode';
import Atmosphere from './scenes/Atmosphere';
import Identity from './scenes/Identity';
import World from './scenes/World';
import Narrative from './scenes/Narrative';
import PointerCamera from './PointerCamera';
import Smoke from './scenes/Smoke';
import Chapters from './Chapters';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

/**
 * Scroll length for the whole film, expressed in viewport heights.
 *
 * Each narrative beat owns roughly a tenth of this distance: at 900px tall the
 * four lines hold for ~2,200px each instead of flicking past in a few hundred.
 * That slower cadence gives every fade, blur and camera push room to breathe.
 */
const TRAVEL_DESKTOP = 30;
const TRAVEL_PORTRAIT = 22;

export default function Cinematic() {
  const { tall, narrow, reduced } = useViewMode();
  const filmRef = useRef<Film | null>(null);
  const film = filmRef.current ?? (filmRef.current = new Film(0));
  const rootRef = useRef<HTMLElement>(null);
  const whiteRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  /** When a fixed frame is forced (visual QA), scroll must not steal it back. */
  const forcedRef = useRef(false);

  useLayoutEffect(
    () =>
      film.subscribe((frame) => {
        if (whiteRef.current) whiteRef.current.style.opacity = frame.white.toFixed(4);
        if (threadRef.current) {
          const fade = 1 - Math.min(1, frame.p / 0.014);
          threadRef.current.style.opacity = (fade * 0.26).toFixed(3);
        }
        if (scrimRef.current) {
          const clear = smoothstep(frame.p, 0.44, 0.58);
          scrimRef.current.style.opacity = (0.3 + 0.55 * clear).toFixed(3);
        }
        if (cueRef.current) {
          // Always present, except where the closing whiteout would otherwise
          // show it faintly through the white.
          cueRef.current.style.opacity = (1 - smoothstep(frame.white, 0.2, 0.6)).toFixed(3);
        }
      }),
    [film],
  );

  // ScrollTrigger owns the pin, the travel distance and the smoothing; every
  // pixel of the film is derived from the single normalised progress value.
  useLayoutEffect(() => {
    if (reduced) return;
    const root = rootRef.current;
    if (!root) return;

    if (!window.location.hash) window.scrollTo(0, 0);

    const proxy = { p: 0 };
    const travel = () => Math.round(window.innerHeight * (tall ? TRAVEL_PORTRAIT : TRAVEL_DESKTOP));

    const context = gsap.context(() => {
      const tween = gsap.to(proxy, {
        p: 1,
        duration: 1,
        ease: 'none',
        paused: true,
        onUpdate: () => {
          if (!forcedRef.current) film.set(proxy.p);
        },
      });

      ScrollTrigger.create({
        id: 'palace-film',
        trigger: root,
        start: 'top top',
        end: () => `+=${travel()}`,
        pin: root,
        pinSpacing: true,
        anticipatePin: 1,
        // Longer scrub gives the film inertia: the image glides toward the next
        // frame after the wheel stops instead of snapping to it.
        scrub: 1.15,
        invalidateOnRefresh: true,
        animation: tween,
      });
    }, root);

    film.set(0);

    let alive = true;
    const refresh = () => {
      if (alive) ScrollTrigger.refresh();
    };
    void document.fonts?.ready.then(refresh);
    const onResize = () => window.setTimeout(refresh, 120);
    window.addEventListener('resize', onResize);

    return () => {
      alive = false;
      window.removeEventListener('resize', onResize);
      context.revert();
    };
  }, [film, reduced, tall]);

  useLayoutEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__palace = {
      force: (progress: number) => {
        forcedRef.current = true;
        film.set(progress);
      },
      release: () => {
        forcedRef.current = false;
      },
      progress: () => film.frame.p,
      frame: () => film.frame,
    };
    // Deterministic single-frame rendering for visual QA: /?p=0.42
    const requested = new URLSearchParams(window.location.search).get('p');
    if (requested !== null) {
      const progress = Number.parseFloat(requested);
      if (Number.isFinite(progress)) {
        forcedRef.current = true;
        film.set(Math.min(1, Math.max(0, progress)));
      }
    }
    return () => {
      delete window.__palace;
    };
  }, [film]);

  return (
    <FilmContext.Provider value={film}>
      <section className="cinematic" ref={rootRef} aria-label="Opening cinematic">
        <div className="cinema-stage" ref={stageRef}>
          <Atmosphere mobile={narrow} />
          <World variant={tall ? 'tall' : 'wide'} />
          <Smoke part="back" mobile={narrow} />
          <div className="world-scrim" ref={scrimRef} aria-hidden="true" />
          <Narrative />
          <Identity />
          <Smoke part="front" mobile={narrow} />
          <div className="whiteout" ref={whiteRef} aria-hidden="true" />
          <div className="scroll-thread" ref={threadRef} aria-hidden="true" />
          <div className="scroll-cue" ref={cueRef} aria-hidden="true">
            <svg
              className="scroll-cue__chevrons"
              viewBox="0 0 24 34"
              fill="none"
              aria-hidden="true"
            >
              <path d="M5.5 6.5 L12 13 L18.5 6.5" />
              <path d="M5.5 18.5 L12 25 L18.5 18.5" />
            </svg>
            <span className="scroll-cue__label">Scroll to continue</span>
          </div>
          <PointerCamera targetRef={stageRef} />
        </div>
      </section>
      <Chapters />
    </FilmContext.Provider>
  );
}
