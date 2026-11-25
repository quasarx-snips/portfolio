/**
 * The accessible reduced-motion journey.
 *
 * When the visitor asks for `prefers-reduced-motion: reduce`, the scroll-
 * scrubbed opening is replaced by four ordinary full-viewport acts read by
 * plain document scrolling. Nothing here is pinned, scroll-jacked, timed or
 * animated on its own: each act holds one static frame of the same film,
 * composed from the same scenes. Content fades in gently once as each act
 * enters the viewport, and then stays visible.
 */

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Film, FilmContext } from './film';
import Atmosphere from './scenes/Atmosphere';
import Identity from './scenes/Identity';
import World from './scenes/World';
import Narrative from './scenes/Narrative';
import Smoke from './scenes/Smoke';
import { useViewMode } from './useViewMode';
import '../styles/reduced.css';

/**
 * The still frames each act is art-directed from:
 * the palace lit under the emerging sky, the trio fully formed, and the pale
 * smoke at its fullest before the white.
 */
const BEGINNING_P = 0.2;
const IDENTITY_P = 0.66;
const DISSOLUTION_P = 0.86;

/**
 * One still frame of the film. `Film` computes its frame in the constructor
 * and `subscribe` fires immediately, so the scenes paint once and hold.
 */
function StaticFilm({ p, children }: { p: number; children: ReactNode }) {
  const film = useMemo(() => new Film(p), [p]);
  return <FilmContext.Provider value={film}>{children}</FilmContext.Provider>;
}

/**
 * Fades each composition in once via IntersectionObserver, then leaves it
 * visible forever. No timers, no re-triggering.
 */
function useFadeIn() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>('.rm-reveal'));
    const reveal = (element: Element) => element.classList.add('rm-visible');

    if (typeof IntersectionObserver === 'undefined') {
      for (const target of targets) reveal(target);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -5% 0px' },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return rootRef;
}

export default function ReducedExperience() {
  const { tall, narrow } = useViewMode();
  const rootRef = useFadeIn();

  return (
    <div className="rm-experience" ref={rootRef}>
      {/* Act I — The Beginning: the illustrated palace and the whole poem. */}
      <section className="rm-act rm-act--beginning">
        <h2 className="sr-only">The Beginning</h2>
        <StaticFilm p={BEGINNING_P}>
          <div className="rm-scene rm-reveal">
            <div className="rm-env">
              <World variant={tall ? 'tall' : 'wide'} />
            </div>
            <div className="rm-atmos">
              <Atmosphere mobile={narrow} />
            </div>
          </div>
          <div className="rm-verse rm-reveal">
            <Narrative staticPoem />
          </div>
        </StaticFilm>
      </section>

      {/* Act II — The Identity: the three names composed as the trio. */}
      <section className="rm-act rm-act--identity">
        <h2 className="sr-only">The Identity</h2>
        <StaticFilm p={IDENTITY_P}>
          <div className="rm-env">
            <World variant={tall ? 'tall' : 'wide'} />
            <div className="rm-band" aria-hidden="true" />
          </div>
          <div className="rm-atmos">
            <Atmosphere mobile={narrow} />
          </div>
          <div className="rm-trio rm-reveal">
            <Identity staticTrio />
          </div>
        </StaticFilm>
      </section>

      {/*
        Act III — The Dissolution: pale smoke fills the frame while a faint
        ghost of the name trio sits beneath it, being absorbed. The ghost is
        sandwiched between the two smoke planes exactly as in the scrubbed
        film: the back plane behind it, the front veil over it.
      */}
      <section className="rm-act rm-act--dissolution">
        <h2 className="sr-only">The Dissolution</h2>
        <StaticFilm p={DISSOLUTION_P}>
          <div className="rm-dissolve rm-reveal">
            <div className="rm-smoke-layer rm-smoke-back">
              <Smoke part="back" mobile={narrow} />
            </div>
            <div className="rm-ghost rm-trio">
              <Identity staticTrio />
            </div>
            <div className="rm-smoke-layer rm-smoke-front">
              <Smoke part="front" mobile={narrow} />
            </div>
          </div>
          <div className="rm-atmos rm-atmos--above">
            <Atmosphere mobile={narrow} />
          </div>
        </StaticFilm>
      </section>

      {/* Act IV — White: the held endpoint, no text, no interface. */}
      <section className="rm-act rm-act--white" aria-hidden="true">
        <div className="rm-white-surface" />
      </section>
    </div>
  );
}