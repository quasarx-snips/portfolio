import { useLayoutEffect, useState } from 'react';
import { useFilm } from './film';

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
  { key: 'dissolution', label: 'The dissolution', from: 0.72, to: 1 },
];

export default function Chapters() {
  const film = useFilm();
  const [act, setAct] = useState(ACTS[0].key);

  useLayoutEffect(() => {
    const pick = (p: number) => {
      const current = ACTS.find((a) => p >= a.from && p < a.to) ?? ACTS[ACTS.length - 1];
      setAct(current.key);
    };
    pick(film.frame.p);
    return film.subscribe((frame) => pick(frame.p));
  }, [film]);

  const current = ACTS.find((a) => a.key === act) ?? ACTS[0];

  return (
    <nav className="cinema-chapters" aria-label="Chapters">
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
