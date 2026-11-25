import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import CosmicOpening from './cine/cosmos/CosmicOpening';
import { useViewMode } from './cine/useViewMode';
import './styles/cinematic.css';

/**
 * Pages mount in the order the visitor meets them: the prologue first, the
 * scroll film only once the white sheet covers the stage, the corridor after
 * the film, and the reduced journey immediately when motion is reduced. Their
 * code and assets were already fetched during boot, so mounting is a
 * composition step, not a wait.
 *
 * The film is deliberately withheld during the black hole: its ScrollTrigger
 * pin, canvas sizing and smoke atlas would otherwise compete with the shader
 * for the main thread during the only moment the visitor is looking at it.
 */
const Cinematic = lazy(() => import('./cine/Cinematic'));
const ReducedExperience = lazy(() => import('./cine/ReducedExperience'));
const Corridor = lazy(() => import('./temple/Corridor'));

/**
 * `?room=<id|index>` and `#room-<id>` are how a room is shared. They skip the
 * prologue and the film entirely: a shared room should open on the room.
 */
function isRoomLink(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('room')) return true;
  return window.location.hash.startsWith('#room-');
}

function readFastFile(): boolean {
  if (typeof window === 'undefined') return false;
  // Dev QA: /?p=0.5 needs the film mounted without a prologue interaction.
  if (new URLSearchParams(window.location.search).has('p')) return true;
  // A hash deep link starts at the film, so the prologue never runs.
  return Boolean(window.location.hash);
}

export default function App() {
  const { reduced } = useViewMode();
  const [directRoom] = useState(isRoomLink);
  const [filmMounted, setFilmMounted] = useState(() => readFastFile() || reduced);
  const fadeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    if (!window.location.hash) window.scrollTo(0, 0);

    const node = fadeRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.classList.add('is-visible');
            observer.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <main id="top">
      <h1 className="sr-only">Bibhab — The Palace of Many Worlds</h1>
      {directRoom ? (
        <Suspense fallback={null}>
          <Corridor />
        </Suspense>
      ) : reduced ? (
        <>
          <Suspense fallback={null}>
            <ReducedExperience />
          </Suspense>
          <Suspense fallback={null}>
            <Corridor />
          </Suspense>
        </>
      ) : (
        <>
          <CosmicOpening onCovered={() => setFilmMounted(true)} />
          {filmMounted ? (
            <Suspense fallback={null}>
              <Cinematic />
            </Suspense>
          ) : null}
          <Suspense fallback={null}>
            <Corridor />
          </Suspense>
        </>
      )}
      {directRoom ? null : (
        <section className="aftermath" id="after-opening" aria-labelledby="after-line">
          <div className="aftermath-inner" ref={fadeRef}>
            <p className="aftermath-line" id="after-line">
              The opening ends here.
            </p>
            <a className="aftermath-link" href="#top">
              Return to the beginning
            </a>
          </div>
        </section>
      )}
    </main>
  );
}
