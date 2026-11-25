import { useLayoutEffect, useRef, useState } from 'react';
import { useFilm } from './film';
import { smoothstep } from './easing';

/**
 * The film's chapter beats, as progress windows.
 *
 * The scroll film now runs roughly thirty viewport heights, so the visitor
 * needs a lightweight sense of where they are. The rail is passive — it only
 * reads the film frame, it never drives anything.
 */
const ACTS = [
  { key: 'beginning', label: 'The beginning', from: 0, to: 0.3 },
  { key: 'names', label: 'The names', from: 0.3, to: 0.72 },
  { key: 'dissolution', label: 'The dissolution', from: 0.72, to: 0.88 },
  { key: 'threshold', label: 'The threshold', from: 0.88, to: 1 },
];

export default function Chapters() {
  const film = useFilm();
  const [act, setAct] = useState(ACTS[0].key);
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const pick = (p: number) => {
      const current = ACTS.find((a) => a.from <= p && p < a.to) ?? ACTS[ACTS.length - 1];
      setAct(current.key);
    };
    pick(film.frame.p);
    return film.subscribe((frame) => {
      pick(frame.p);
      // Over the door the rail would sit on the paper; it steps aside for the
      // last stretch and returns the moment the visitor scrolls back up.
      if (navRef.current) {
        navRef.current.style.opacity = (1 - smoothstep(frame.p, 0.88, 0.94)).toFixed(3);
      }
    });
  }, [film]);

  const current = ACTS.find((a) => a.key === act) ?? ACTS[0];

  return (
    <nav className="cinema-chapters" aria-label="Chapters" ref={navRef}>
      {ACTS.map((a) => (
        <span
          key={a.key}
          className={`cinema-chapters__item${a.key === current.key ? ' is-active' : ''}`}
        />
      ))}
      <span className="cinema-chapters__label">{current.label}</span>
    </nav>
  );
}
