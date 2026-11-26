import { useLayoutEffect, useRef } from 'react';
import { NARRATIVE } from '../../content/opening';
import { useFilm } from '../film';

/**
 * The four narrative lines, shown one at a time. Each line arrives, holds for
 * a beat, then clears the frame before the next one enters. The reduced-motion
 * variant keeps all four as a static poem.
 */
export default function Narrative({ staticPoem = false }: { staticPoem?: boolean }) {
  const film = useFilm();
  const refs = useRef<Array<HTMLParagraphElement | null>>([]);

  useLayoutEffect(() => {
    if (staticPoem) return;
    return film.subscribe((frame) => {
      for (const [index, element] of refs.current.entries()) {
        if (!element) continue;
        const line = frame.lines[index];
        if (!line) continue;
        element.style.opacity = line.opacity.toFixed(3);
        element.style.filter = line.blur > 0.05 ? `blur(${line.blur.toFixed(2)}px)` : 'none';
        element.style.transform = `translate3d(0, calc(-50% + ${line.y.toFixed(2)}px), 0) scale(${line.scale.toFixed(4)})`;
      }
    });
  }, [film, staticPoem]);

  return (
    <div className={`narrative${staticPoem ? ' is-static' : ''}`}>
      <p className="sr-only">
        {NARRATIVE.map((line) => line.replace(/\.\.\./g, '').trim()).join(' ')}
      </p>
      <div className="narrative-lines" aria-hidden="true">
        {NARRATIVE.map((line, index) => (
          <p
            key={line}
            className="narration-line"
            ref={(element) => {
              refs.current[index] = element;
            }}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
